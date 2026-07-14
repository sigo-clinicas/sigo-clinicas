import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S3-2 — RPC vender_orcamento. Testes obrigatórios (CLAUDE.md §5):
 *  ATOMICIDADE (parcelas inválidas → nada gravado; orçamento já vendido → 23505),
 *  CÁLCULO financeiro (venda gera N pagamentos que somam o total + N lançamentos
 *  receita vinculados), RBAC (recepção vende; profissional e clínica alheia não).
 */
describe.skipIf(!temAmbiente)("RPC vender_orcamento (S3-2)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailPropA = `vnd-prop-a-${sufixo}@teste.sigo`;
  const emailRecepA = `vnd-recep-a-${sufixo}@teste.sigo`;
  const emailProfA = `vnd-prof-a-${sufixo}@teste.sigo`;
  const emailPropB = `vnd-prop-b-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaA: string, clinicaB: string;
  let userPropA: string, userRecepA: string, userProfA: string, userPropB: string;
  let orcA1: string, orcA2: string, orcA3: string, orcRasc: string;

  const parcelas100em3 = [
    { numero: 1, valor: 33.34, vencimento: "2026-07-14" },
    { numero: 2, valor: 33.33, vencimento: "2026-08-14" },
    { numero: 3, valor: 33.33, vencimento: "2026-09-14" },
  ];

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Vnd A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Vnd B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    [clinicaA, clinicaB] = clinicas!.map((c) => c.id);

    userPropA = await criarUsuario(admin, emailPropA, senha);
    userRecepA = await criarUsuario(admin, emailRecepA, senha);
    userProfA = await criarUsuario(admin, emailProfA, senha);
    userPropB = await criarUsuario(admin, emailPropB, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userPropA, papel: "proprietario" },
      { clinica_id: clinicaA, user_id: userRecepA, papel: "recepcionista" },
      { clinica_id: clinicaA, user_id: userProfA, papel: "profissional" },
      { clinica_id: clinicaB, user_id: userPropB, papel: "proprietario" },
    ]);
    await admin
      .from("profissional")
      .insert({ clinica_id: clinicaA, nome: `Dr Vnd ${sufixo}`, user_id: userProfA });

    const { data: orcs } = await admin
      .from("orcamento")
      .insert([
        { clinica_id: clinicaA, cliente_nome: "C1", status: "aprovado", valor_total: 100, valor_final: 100 },
        { clinica_id: clinicaA, cliente_nome: "C2", status: "aprovado", valor_total: 100, valor_final: 100 },
        { clinica_id: clinicaA, cliente_nome: "C3", status: "aprovado", valor_total: 100, valor_final: 100 },
        { clinica_id: clinicaA, cliente_nome: "CR", status: "rascunho", valor_total: 50, valor_final: 50 },
      ])
      .select("id");
    [orcA1, orcA2, orcA3, orcRasc] = orcs!.map((o) => o.id);
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaA) await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    for (const uid of [userPropA, userRecepA, userProfA, userPropB]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  // ---- CÁLCULO financeiro ----------------------------------------------------

  it("vende: gera venda + N pagamentos (somam o total) + N lançamentos receita", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { data: vendaId, error } = await sup.rpc("vender_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento_id: orcA1,
      p_forma_pagamento: "pix",
      p_data_venda: "2026-07-14",
      p_parcelas: parcelas100em3,
    });
    expect(error).toBeNull();

    const { data: pags } = await sup
      .from("pagamento")
      .select("valor,numero_parcela,lancamento_id")
      .eq("venda_id", vendaId as string);
    expect(pags!.length).toBe(3);
    const soma = pags!.reduce((a, p) => a + Number(p.valor), 0);
    expect(Math.round(soma * 100) / 100).toBe(100);
    expect(pags!.every((p) => p.lancamento_id !== null)).toBe(true);

    const { data: lancs } = await sup
      .from("lancamento_financeiro")
      .select("tipo,status,valor")
      .eq("venda_id", vendaId as string);
    expect(lancs!.length).toBe(3);
    expect(lancs!.every((l) => l.tipo === "receita" && l.status === "pendente")).toBe(true);
    expect(Math.round(lancs!.reduce((a, l) => a + Number(l.valor), 0) * 100) / 100).toBe(100);
  });

  it("orçamento já vendido → 23505 (unicidade da venda)", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { error } = await sup.rpc("vender_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento_id: orcA1,
      p_forma_pagamento: "pix",
      p_data_venda: "2026-07-14",
      p_parcelas: parcelas100em3,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23505");
  });

  // ---- ATOMICIDADE -----------------------------------------------------------

  it("parcelas que não somam o total → 23514 e NADA é gravado", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { error } = await sup.rpc("vender_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento_id: orcA2,
      p_forma_pagamento: "pix",
      p_data_venda: "2026-07-14",
      p_parcelas: [{ numero: 1, valor: 90, vencimento: "2026-07-14" }], // soma 90 ≠ 100
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");

    // rollback: nenhuma venda/pagamento/lançamento para orcA2
    const { data: venda } = await admin
      .from("venda")
      .select("id")
      .eq("orcamento_id", orcA2)
      .maybeSingle();
    expect(venda).toBeNull();
    const { count } = await admin
      .from("lancamento_financeiro")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaA)
      .eq("descricao", "C2 - Parcela 1");
    expect(count ?? 0).toBe(0);
  });

  it("orçamento não aprovado → 23514", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { error } = await sup.rpc("vender_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento_id: orcRasc,
      p_forma_pagamento: "pix",
      p_data_venda: "2026-07-14",
      p_parcelas: [{ numero: 1, valor: 50, vencimento: "2026-07-14" }],
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");
  });

  // ---- RBAC ------------------------------------------------------------------

  it("profissional NÃO vende (42501); clínica alheia NÃO vende (42501)", async () => {
    const supProf = await clientLogado(emailProfA, senha);
    const r1 = await supProf.rpc("vender_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento_id: orcA3,
      p_forma_pagamento: "pix",
      p_data_venda: "2026-07-14",
      p_parcelas: [{ numero: 1, valor: 100, vencimento: "2026-07-14" }],
    });
    expect(r1.error!.code).toBe("42501");

    const supB = await clientLogado(emailPropB, senha);
    const r2 = await supB.rpc("vender_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento_id: orcA3,
      p_forma_pagamento: "pix",
      p_data_venda: "2026-07-14",
      p_parcelas: [{ numero: 1, valor: 100, vencimento: "2026-07-14" }],
    });
    expect(r2.error!.code).toBe("42501");
  });

  it("recepcionista PODE vender", async () => {
    const sup = await clientLogado(emailRecepA, senha);
    const { error } = await sup.rpc("vender_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento_id: orcA3,
      p_forma_pagamento: "dinheiro",
      p_data_venda: "2026-07-14",
      p_parcelas: [{ numero: 1, valor: 100, vencimento: "2026-07-14" }],
    });
    expect(error).toBeNull();
    const { data: venda } = await admin
      .from("venda")
      .select("id")
      .eq("orcamento_id", orcA3)
      .maybeSingle();
    expect(venda).not.toBeNull();
  });
});
