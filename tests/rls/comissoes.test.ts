import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S3-5 — Apuração de comissão. Testes obrigatórios: CÁLCULO (soma vira 1
 * lançamento despesa + N comissões vinculadas), DEDUP/idempotência (re-apurar →
 * 23505 sem duplicar), RBAC, trigger (baixa do lançamento → comissão 'paga') e
 * cancelamento (só se não baixada).
 */
describe.skipIf(!temAmbiente)("Comissões: apuração (S3-5)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailPropA = `com-prop-a-${sufixo}@teste.sigo`;
  const emailRecepA = `com-recep-a-${sufixo}@teste.sigo`;
  const emailProfA = `com-prof-a-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaA: string, clinicaB: string;
  let userPropA: string, userRecepA: string, userProfA: string;
  let profA: string, profB: string;
  let contaA: string, categoriaA: string;
  let cs1: string, cs2: string, cs3: string;

  const comp = "2026-07-01";
  const venc = "2026-07-31";

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Com A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Com B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    [clinicaA, clinicaB] = clinicas!.map((c) => c.id);

    userPropA = await criarUsuario(admin, emailPropA, senha);
    userRecepA = await criarUsuario(admin, emailRecepA, senha);
    userProfA = await criarUsuario(admin, emailProfA, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userPropA, papel: "proprietario" },
      { clinica_id: clinicaA, user_id: userRecepA, papel: "recepcionista" },
      { clinica_id: clinicaA, user_id: userProfA, papel: "profissional" },
    ]);
    const { data: profs } = await admin
      .from("profissional")
      .insert([
        { clinica_id: clinicaA, nome: `Dr A ${sufixo}`, user_id: userProfA },
        { clinica_id: clinicaB, nome: `Dr B ${sufixo}` },
      ])
      .select("id,clinica_id");
    profA = profs!.find((p) => p.clinica_id === clinicaA)!.id;
    profB = profs!.find((p) => p.clinica_id === clinicaB)!.id;

    const { data: pac } = await admin
      .from("paciente").insert({ nome: `Pac ${sufixo}` }).select("id").single();
    await admin.from("paciente_clinica").insert({ clinica_id: clinicaA, paciente_id: pac!.id });
    const { data: serv } = await admin
      .from("servico").insert({ clinica_id: clinicaA, nome: `Serv ${sufixo}` }).select("id").single();
    const { data: conta } = await admin
      .from("conta_bancaria").insert({ clinica_id: clinicaA, nome: `Cx ${sufixo}`, tipo: "caixa", saldo_inicial: 0 }).select("id").single();
    contaA = conta!.id;
    const { data: cat } = await admin
      .from("categoria_lancamento").insert({ clinica_id: clinicaA, nome: `Comissões ${sufixo}`, tipo: "despesa" }).select("id").single();
    categoriaA = cat!.id;

    const { data: consulta } = await admin
      .from("consulta")
      .insert({
        clinica_id: clinicaA, paciente_id: pac!.id, profissional_id: profA,
        data_hora: "2026-07-10T14:00:00Z", status: "concluido", duracao_minutos: 30,
      })
      .select("id")
      .single();
    const { data: css } = await admin
      .from("consulta_servico")
      .insert([
        { clinica_id: clinicaA, consulta_id: consulta!.id, servico_id: serv!.id },
        { clinica_id: clinicaA, consulta_id: consulta!.id, servico_id: serv!.id },
        { clinica_id: clinicaA, consulta_id: consulta!.id, servico_id: serv!.id },
      ])
      .select("id");
    [cs1, cs2, cs3] = css!.map((c) => c.id);
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaA) await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    await admin.from("paciente").delete().ilike("nome", `Pac ${sufixo}`);
    for (const uid of [userPropA, userRecepA, userProfA]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  let lancA: string;

  it("apura: gera 1 lançamento despesa (soma) + N comissões vinculadas", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { data: lancId, error } = await sup.rpc("apurar_comissao", {
      p_clinica_id: clinicaA,
      p_profissional_id: profA,
      p_competencia: comp,
      p_vencimento: venc,
      p_categoria_id: categoriaA,
      p_itens: [
        { consulta_servico_id: cs1, tipo_comissao: "percentual", base_calculo: 200, valor: 20 },
        { consulta_servico_id: cs2, tipo_comissao: "valor_fixo", valor: 50 },
      ],
    });
    expect(error).toBeNull();
    lancA = lancId as string;

    const { data: lanc } = await admin
      .from("lancamento_financeiro").select("tipo,valor,status").eq("id", lancA).single();
    expect(lanc!.tipo).toBe("despesa");
    expect(Number(lanc!.valor)).toBe(70); // 20 + 50
    expect(lanc!.status).toBe("pendente");

    const { data: comis } = await admin
      .from("comissao").select("valor,status,lancamento_id").eq("lancamento_id", lancA);
    expect(comis!.length).toBe(2);
    expect(comis!.every((c) => c.status === "pendente")).toBe(true);
  });

  it("dedup: re-apurar as mesmas execuções → 23505 sem duplicar", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { error } = await sup.rpc("apurar_comissao", {
      p_clinica_id: clinicaA, p_profissional_id: profA, p_competencia: comp,
      p_vencimento: venc, p_categoria_id: categoriaA,
      p_itens: [{ consulta_servico_id: cs1, tipo_comissao: "percentual", base_calculo: 200, valor: 20 }],
    });
    expect(error!.code).toBe("23505");
    const { count } = await admin
      .from("comissao").select("id", { count: "exact", head: true }).eq("consulta_servico_id", cs1);
    expect(count).toBe(1);
  });

  it("RBAC: recepção não apura (42501); profissional de outra clínica → 23514", async () => {
    const recep = await clientLogado(emailRecepA, senha);
    const r1 = await recep.rpc("apurar_comissao", {
      p_clinica_id: clinicaA, p_profissional_id: profA, p_competencia: comp,
      p_vencimento: venc, p_categoria_id: categoriaA,
      p_itens: [{ consulta_servico_id: cs3, tipo_comissao: "valor_fixo", valor: 10 }],
    });
    expect(r1.error!.code).toBe("42501");

    const prop = await clientLogado(emailPropA, senha);
    const r2 = await prop.rpc("apurar_comissao", {
      p_clinica_id: clinicaA, p_profissional_id: profB, p_competencia: comp,
      p_vencimento: venc, p_categoria_id: categoriaA,
      p_itens: [{ consulta_servico_id: cs3, tipo_comissao: "valor_fixo", valor: 10 }],
    });
    expect(r2.error!.code).toBe("23514");
  });

  it("trigger: baixa do lançamento de comissão → comissão 'paga'", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { error } = await sup.rpc("registrar_baixa_lancamento", {
      p_clinica_id: clinicaA, p_lancamento_id: lancA, p_conta_id: contaA,
      p_valor: 70, p_data: venc, p_forma: "pix", p_obs: "",
    });
    expect(error).toBeNull();
    const { data: comis } = await admin
      .from("comissao").select("status").eq("lancamento_id", lancA);
    expect(comis!.every((c) => c.status === "paga")).toBe(true);
  });

  it("cancelar apuração baixada → 23514; nova apuração pode ser cancelada", async () => {
    const sup = await clientLogado(emailPropA, senha);
    // lancA já baixado → não cancela
    const naoPode = await sup.rpc("cancelar_apuracao_comissao", {
      p_clinica_id: clinicaA, p_lancamento_id: lancA,
    });
    expect(naoPode.error!.code).toBe("23514");

    // apura cs3 (novo) e cancela
    const { data: lanc3 } = await sup.rpc("apurar_comissao", {
      p_clinica_id: clinicaA, p_profissional_id: profA, p_competencia: comp,
      p_vencimento: venc, p_categoria_id: categoriaA,
      p_itens: [{ consulta_servico_id: cs3, tipo_comissao: "valor_fixo", valor: 30 }],
    });
    const { error } = await sup.rpc("cancelar_apuracao_comissao", {
      p_clinica_id: clinicaA, p_lancamento_id: lanc3 as string,
    });
    expect(error).toBeNull();
    const { data: lancDel } = await admin
      .from("lancamento_financeiro").select("id").eq("id", lanc3 as string).maybeSingle();
    expect(lancDel).toBeNull();
    const { data: comis } = await admin
      .from("comissao").select("status").eq("consulta_servico_id", cs3).single();
    expect(comis!.status).toBe("cancelada");
  });
});
