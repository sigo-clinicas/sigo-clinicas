import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S4-5 — Fechamento de guia por convênio. Testes obrigatórios:
 *  - CÁLCULO/IDEMPOTÊNCIA: gerar_recebiveis cria 1 lançamento por consulta
 *    concluída do convênio (nunca particular/agendada), e re-rodar não duplica.
 *  - RBAC: recepção não gera nem baixa (42501). Isolamento: convênio de outra
 *    clínica → 23514.
 *  - RECONCILIAÇÃO: a baixa em lote gera movimentacao_conta que soma exatamente
 *    o total baixado, e quita os lançamentos.
 *  - ATOMICIDADE: se um item da baixa em lote excede o saldo, a transação
 *    inteira reverte (nada é baixado) — reuso do gate do S3.
 */
describe.skipIf(!temAmbiente)("Convênios: fechamento de guia (S4-5)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailProp = `conv-prop-${sufixo}@teste.sigo`;
  const emailRecep = `conv-recep-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaA: string, clinicaB: string;
  let userProp: string, userRecep: string;
  let profA: string, pacA: string, contaA: string;
  let convA: string, convC: string, convB: string;

  const ini = "2026-07-01";
  const fim = "2026-07-31";

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Conv A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Conv B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    [clinicaA, clinicaB] = clinicas!.map((c) => c.id);

    userProp = await criarUsuario(admin, emailProp, senha);
    userRecep = await criarUsuario(admin, emailRecep, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userProp, papel: "proprietario" },
      { clinica_id: clinicaA, user_id: userRecep, papel: "recepcionista" },
    ]);

    const { data: prof } = await admin
      .from("profissional")
      .insert({ clinica_id: clinicaA, nome: `Dr A ${sufixo}` })
      .select("id")
      .single();
    profA = prof!.id;

    const { data: pac } = await admin
      .from("paciente").insert({ nome: `Pac ${sufixo}` }).select("id").single();
    pacA = pac!.id;
    await admin.from("paciente_clinica").insert({ clinica_id: clinicaA, paciente_id: pacA });

    const { data: convs } = await admin
      .from("convenio")
      .insert([
        { clinica_id: clinicaA, nome: `Unimed ${sufixo}`, tipo: "plano_saude", prazo_pagamento_dias: 30 },
        { clinica_id: clinicaA, nome: `Bradesco ${sufixo}`, tipo: "plano_saude", prazo_pagamento_dias: 45 },
        { clinica_id: clinicaB, nome: `Amil ${sufixo}`, tipo: "plano_saude" },
      ])
      .select("id,clinica_id,nome");
    convA = convs!.find((c) => c.nome.startsWith("Unimed"))!.id;
    convC = convs!.find((c) => c.nome.startsWith("Bradesco"))!.id;
    convB = convs!.find((c) => c.nome.startsWith("Amil"))!.id;

    const { data: conta } = await admin
      .from("conta_bancaria")
      .insert({ clinica_id: clinicaA, nome: `Cx ${sufixo}`, tipo: "caixa", saldo_inicial: 0 })
      .select("id")
      .single();
    contaA = conta!.id;

    const base = {
      clinica_id: clinicaA,
      paciente_id: pacA,
      profissional_id: profA,
      duracao_minutos: 30,
    };
    await admin.from("consulta").insert([
      // convênio A — concluídas (devem gerar): 120 + 200
      { ...base, convenio_id: convA, numero_guia: "G1", valor: 120, status: "concluido", data_hora: "2026-07-05T14:00:00Z" },
      { ...base, convenio_id: convA, numero_guia: "G2", valor: 200, status: "concluido", data_hora: "2026-07-06T14:00:00Z" },
      // convênio A mas AGENDADA (não deve gerar)
      { ...base, convenio_id: convA, numero_guia: "G9", valor: 80, status: "agendado", data_hora: "2026-07-07T14:00:00Z" },
      // concluída SEM convênio (particular — não deve gerar)
      { ...base, convenio_id: null, valor: 100, status: "concluido", data_hora: "2026-07-08T14:00:00Z" },
      // convênio C — concluídas (para atomicidade): 300 + 50
      { ...base, convenio_id: convC, numero_guia: "G3", valor: 300, status: "concluido", data_hora: "2026-07-09T14:00:00Z" },
      { ...base, convenio_id: convC, numero_guia: "G4", valor: 50, status: "concluido", data_hora: "2026-07-10T14:00:00Z" },
    ]);
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaA) await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    await admin.from("paciente").delete().eq("id", pacA);
    for (const uid of [userProp, userRecep]) if (uid) await admin.auth.admin.deleteUser(uid);
  });

  async function lancamentosDe(convenioId: string) {
    const { data } = await admin
      .from("lancamento_financeiro")
      .select("id,valor,valor_pago,status")
      .eq("clinica_id", clinicaA)
      .eq("convenio_id", convenioId)
      .eq("tipo", "receita")
      .order("valor");
    return data ?? [];
  }

  it("gera 1 recebível por consulta concluída do convênio; idempotente", async () => {
    const sup = await clientLogado(emailProp, senha);
    const r1 = await sup.rpc("gerar_recebiveis_convenio", {
      p_clinica_id: clinicaA, p_convenio_id: convA, p_ini: ini, p_fim: fim,
    });
    expect(r1.error).toBeNull();
    expect(r1.data).toMatchObject({ criados: 2 });
    expect(Number((r1.data as { total: number }).total)).toBe(320);

    // não pegou a agendada nem a particular
    const lancs = await lancamentosDe(convA);
    expect(lancs.length).toBe(2);
    expect(lancs.map((l) => Number(l.valor))).toEqual([120, 200]);

    // re-rodar não duplica
    const r2 = await sup.rpc("gerar_recebiveis_convenio", {
      p_clinica_id: clinicaA, p_convenio_id: convA, p_ini: ini, p_fim: fim,
    });
    expect(r2.data).toMatchObject({ criados: 0 });
    expect((await lancamentosDe(convA)).length).toBe(2);
  });

  it("RBAC: recepção não gera (42501); convênio de outra clínica → 23514", async () => {
    const recep = await clientLogado(emailRecep, senha);
    const r1 = await recep.rpc("gerar_recebiveis_convenio", {
      p_clinica_id: clinicaA, p_convenio_id: convA, p_ini: ini, p_fim: fim,
    });
    expect(r1.error!.code).toBe("42501");

    const prop = await clientLogado(emailProp, senha);
    const r2 = await prop.rpc("gerar_recebiveis_convenio", {
      p_clinica_id: clinicaA, p_convenio_id: convB, p_ini: ini, p_fim: fim,
    });
    expect(r2.error!.code).toBe("23514");
  });

  it("baixa em lote reconcilia com o extrato e quita os lançamentos", async () => {
    const sup = await clientLogado(emailProp, senha);
    const lancs = await lancamentosDe(convA); // [120, 200]
    const itens = lancs.map((l) => ({ lancamento_id: l.id, valor: Number(l.valor) }));

    const r = await sup.rpc("registrar_baixa_lote_convenio", {
      p_clinica_id: clinicaA, p_conta_id: contaA, p_forma: "convenio",
      p_data: "2026-07-20", p_itens: itens,
    });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ baixados: 2 });
    expect(Number((r.data as { total: number }).total)).toBe(320);

    // lançamentos quitados
    const depois = await lancamentosDe(convA);
    expect(depois.every((l) => l.status === "pago")).toBe(true);

    // extrato soma exatamente 320
    const { data: movs } = await admin
      .from("movimentacao_conta").select("valor,tipo").eq("clinica_id", clinicaA);
    const entradas = (movs ?? []).filter((m) => m.tipo === "entrada").reduce((a, m) => a + Number(m.valor), 0);
    expect(entradas).toBe(320);

    // saldo derivado da view bate
    const { data: saldo } = await admin
      .from("saldo_conta_bancaria").select("saldo_atual").eq("conta_bancaria_id", contaA).single();
    expect(Number(saldo!.saldo_atual)).toBe(320);
  });

  it("atômico: se um item excede o saldo, o lote inteiro reverte", async () => {
    const sup = await clientLogado(emailProp, senha);
    // gera recebíveis do convênio C: 300 + 50
    await sup.rpc("gerar_recebiveis_convenio", {
      p_clinica_id: clinicaA, p_convenio_id: convC, p_ini: ini, p_fim: fim,
    });
    const lancs = await lancamentosDe(convC); // [50, 300]
    const l50 = lancs.find((l) => Number(l.valor) === 50)!;
    const l300 = lancs.find((l) => Number(l.valor) === 300)!;

    // recepção não baixa
    const recep = await clientLogado(emailRecep, senha);
    const rRbac = await recep.rpc("registrar_baixa_lote_convenio", {
      p_clinica_id: clinicaA, p_conta_id: contaA, p_forma: "convenio",
      p_data: "2026-07-20", p_itens: [{ lancamento_id: l50.id, valor: 50 }],
    });
    expect(rRbac.error!.code).toBe("42501");

    // um item válido (50) + um excedendo o saldo (999 > 300) → 23514, nada baixado
    const r = await sup.rpc("registrar_baixa_lote_convenio", {
      p_clinica_id: clinicaA, p_conta_id: contaA, p_forma: "convenio",
      p_data: "2026-07-20", p_itens: [
        { lancamento_id: l50.id, valor: 50 },
        { lancamento_id: l300.id, valor: 999 },
      ],
    });
    expect(r.error!.code).toBe("23514");

    // nenhum dos dois foi baixado (rollback)
    const depois = await lancamentosDe(convC);
    expect(depois.every((l) => l.status === "pendente")).toBe(true);
    expect(depois.every((l) => Number(l.valor_pago) === 0)).toBe(true);

    // extrato inalterado (continua 320 do teste anterior)
    const { data: movs } = await admin
      .from("movimentacao_conta").select("valor,tipo").eq("clinica_id", clinicaA);
    const entradas = (movs ?? []).filter((m) => m.tipo === "entrada").reduce((a, m) => a + Number(m.valor), 0);
    expect(entradas).toBe(320);
  });
});
