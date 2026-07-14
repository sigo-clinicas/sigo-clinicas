import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S3-3 — Baixa financeira transacional (corrige A6). Testes obrigatórios:
 *  ATOMICIDADE (baixa acima do saldo → 23514 e movimentacao_conta NÃO criada),
 *  A6 (DESPESA gera saída no extrato), CÁLCULO (parcial→pago_parcial→pago),
 *  SALDO derivado da view, "UI não insere movimentacao/baixa direto", RBAC.
 */
describe.skipIf(!temAmbiente)("Financeiro: baixa transacional (S3-3)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailPropA = `fin-prop-a-${sufixo}@teste.sigo`;
  const emailRecepA = `fin-recep-a-${sufixo}@teste.sigo`;
  const emailPropB = `fin-prop-b-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaA: string, clinicaB: string;
  let userPropA: string, userRecepA: string, userPropB: string;
  let contaA: string;
  let lancD1: string, lancR1: string, lancR2: string, lancD2: string;

  const hoje = "2026-07-14";

  async function saldo(sup: SupabaseClient, conta: string): Promise<number> {
    const { data } = await sup
      .from("saldo_conta_bancaria")
      .select("saldo_atual")
      .eq("conta_bancaria_id", conta)
      .single();
    return Number(data!.saldo_atual);
  }

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Fin A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Fin B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    [clinicaA, clinicaB] = clinicas!.map((c) => c.id);

    userPropA = await criarUsuario(admin, emailPropA, senha);
    userRecepA = await criarUsuario(admin, emailRecepA, senha);
    userPropB = await criarUsuario(admin, emailPropB, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userPropA, papel: "proprietario" },
      { clinica_id: clinicaA, user_id: userRecepA, papel: "recepcionista" },
      { clinica_id: clinicaB, user_id: userPropB, papel: "proprietario" },
    ]);

    const { data: conta } = await admin
      .from("conta_bancaria")
      .insert({ clinica_id: clinicaA, nome: `Caixa ${sufixo}`, tipo: "caixa", saldo_inicial: 0 })
      .select("id")
      .single();
    contaA = conta!.id;

    const { data: lancs } = await admin
      .from("lancamento_financeiro")
      .insert([
        { clinica_id: clinicaA, tipo: "despesa", descricao: "D1", valor: 100, data_vencimento: hoje },
        { clinica_id: clinicaA, tipo: "receita", descricao: "R1", valor: 300, data_vencimento: hoje },
        { clinica_id: clinicaA, tipo: "receita", descricao: "R2", valor: 200, data_vencimento: hoje },
        { clinica_id: clinicaA, tipo: "despesa", descricao: "D2", valor: 50, data_vencimento: hoje },
      ])
      .select("id,descricao");
    lancD1 = lancs!.find((l) => l.descricao === "D1")!.id;
    lancR1 = lancs!.find((l) => l.descricao === "R1")!.id;
    lancR2 = lancs!.find((l) => l.descricao === "R2")!.id;
    lancD2 = lancs!.find((l) => l.descricao === "D2")!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaA) await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    for (const uid of [userPropA, userRecepA, userPropB]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  // ---- A6: despesa gera saída + atualiza status ------------------------------

  it("baixa de DESPESA gera movimentacao 'saida' e quita o lançamento", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { error } = await sup.rpc("registrar_baixa_lancamento", {
      p_clinica_id: clinicaA, p_lancamento_id: lancD1, p_conta_id: contaA,
      p_valor: 100, p_data: hoje, p_forma: "pix", p_obs: "",
    });
    expect(error).toBeNull();

    const { data: mov } = await admin
      .from("movimentacao_conta")
      .select("tipo,valor")
      .eq("lancamento_id", lancD1)
      .single();
    expect(mov!.tipo).toBe("saida");
    expect(Number(mov!.valor)).toBe(100);

    const { data: lanc } = await admin
      .from("lancamento_financeiro")
      .select("valor_pago,status,data_pagamento")
      .eq("id", lancD1)
      .single();
    expect(Number(lanc!.valor_pago)).toBe(100);
    expect(lanc!.status).toBe("pago");
    expect(lanc!.data_pagamento).toBe(hoje);
  });

  // ---- ATOMICIDADE -----------------------------------------------------------

  it("baixa acima do saldo em aberto → 23514 e movimentacao NÃO é criada", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const antes = await saldo(sup, contaA);
    const { error } = await sup.rpc("registrar_baixa_lancamento", {
      p_clinica_id: clinicaA, p_lancamento_id: lancR1, p_conta_id: contaA,
      p_valor: 400, p_data: hoje, p_forma: "pix", p_obs: "", // R1 vale 300
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");

    const { count } = await admin
      .from("movimentacao_conta")
      .select("id", { count: "exact", head: true })
      .eq("lancamento_id", lancR1);
    expect(count ?? 0).toBe(0);
    const { data: lanc } = await admin
      .from("lancamento_financeiro").select("valor_pago,status").eq("id", lancR1).single();
    expect(Number(lanc!.valor_pago)).toBe(0);
    expect(lanc!.status).toBe("pendente");
    expect(await saldo(sup, contaA)).toBe(antes); // rollback: saldo intacto
  });

  // ---- CÁLCULO: parcial → pago ----------------------------------------------

  it("baixa parcial marca pago_parcial; a segunda quita (pago)", async () => {
    const sup = await clientLogado(emailPropA, senha);
    await sup.rpc("registrar_baixa_lancamento", {
      p_clinica_id: clinicaA, p_lancamento_id: lancR2, p_conta_id: contaA,
      p_valor: 120, p_data: hoje, p_forma: "pix", p_obs: "",
    });
    let { data: lanc } = await admin
      .from("lancamento_financeiro").select("valor_pago,status").eq("id", lancR2).single();
    expect(Number(lanc!.valor_pago)).toBe(120);
    expect(lanc!.status).toBe("pago_parcial");

    await sup.rpc("registrar_baixa_lancamento", {
      p_clinica_id: clinicaA, p_lancamento_id: lancR2, p_conta_id: contaA,
      p_valor: 80, p_data: hoje, p_forma: "pix", p_obs: "",
    });
    ({ data: lanc } = await admin
      .from("lancamento_financeiro").select("valor_pago,status").eq("id", lancR2).single());
    expect(Number(lanc!.valor_pago)).toBe(200);
    expect(lanc!.status).toBe("pago");
  });

  // ---- SALDO derivado da view ------------------------------------------------

  it("saldo da view = saldo_inicial + Σ(entrada − saida)", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { data: movs } = await admin
      .from("movimentacao_conta")
      .select("tipo,valor")
      .eq("conta_bancaria_id", contaA);
    const esperado = (movs ?? []).reduce(
      (acc, m) => acc + (m.tipo === "entrada" ? Number(m.valor) : -Number(m.valor)),
      0
    );
    expect(await saldo(sup, contaA)).toBe(esperado);
  });

  // ---- UI não insere movimentacao/baixa direto ------------------------------

  it("UI (mesmo proprietário) NÃO insere movimentacao_conta nem baixa_lancamento", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const mov = await sup.from("movimentacao_conta").insert({
      clinica_id: clinicaA, conta_bancaria_id: contaA, tipo: "entrada", valor: 10, data: hoje,
    });
    expect(mov.error).not.toBeNull();
    const bx = await sup.from("baixa_lancamento").insert({
      clinica_id: clinicaA, lancamento_id: lancD2, conta_bancaria_id: contaA, valor: 10, data: hoje,
    });
    expect(bx.error).not.toBeNull();
  });

  // ---- RBAC ------------------------------------------------------------------

  it("recepcionista NÃO lê financeiro nem dá baixa", async () => {
    const sup = await clientLogado(emailRecepA, senha);
    const { data } = await sup
      .from("lancamento_financeiro").select("id").eq("clinica_id", clinicaA);
    expect((data ?? []).length).toBe(0); // RLS filtra
    const { error } = await sup.rpc("registrar_baixa_lancamento", {
      p_clinica_id: clinicaA, p_lancamento_id: lancD2, p_conta_id: contaA,
      p_valor: 10, p_data: hoje, p_forma: "pix", p_obs: "",
    });
    expect(error!.code).toBe("42501");
  });

  it("clínica alheia não dá baixa (42501)", async () => {
    const sup = await clientLogado(emailPropB, senha);
    const { error } = await sup.rpc("registrar_baixa_lancamento", {
      p_clinica_id: clinicaA, p_lancamento_id: lancD2, p_conta_id: contaA,
      p_valor: 10, p_data: hoje, p_forma: "pix", p_obs: "",
    });
    expect(error!.code).toBe("42501");
  });

  // ---- Estorno ---------------------------------------------------------------

  it("estorno remove o extrato e volta o lançamento a pendente", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { data: baixaId } = await sup.rpc("registrar_baixa_lancamento", {
      p_clinica_id: clinicaA, p_lancamento_id: lancD2, p_conta_id: contaA,
      p_valor: 50, p_data: hoje, p_forma: "pix", p_obs: "",
    });
    const saldoComBaixa = await saldo(sup, contaA);

    const { error } = await sup.rpc("estornar_baixa_lancamento", {
      p_clinica_id: clinicaA, p_baixa_id: baixaId as string,
    });
    expect(error).toBeNull();

    const { data: lanc } = await admin
      .from("lancamento_financeiro").select("valor_pago,status").eq("id", lancD2).single();
    expect(Number(lanc!.valor_pago)).toBe(0);
    expect(lanc!.status).toBe("pendente");
    const { count } = await admin
      .from("movimentacao_conta").select("id", { count: "exact", head: true }).eq("lancamento_id", lancD2);
    expect(count ?? 0).toBe(0);
    expect(await saldo(sup, contaA)).toBe(saldoComBaixa + 50); // saída de 50 revertida
  });
});
