import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S4-4 — Relatórios: RECONCILIAÇÃO com o financeiro do S3 (gate de "done").
 * Invariante: faturamento_recebido (relatorio_dashboard) == Σ movimentacao_conta
 * (entrada) == Σ baixa_lancamento (receita) no período. + RBAC (recepção não lê).
 */
describe.skipIf(!temAmbiente)("Relatórios: reconciliação financeira (S4-4)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailProp = `rel-prop-${sufixo}@teste.sigo`;
  const emailRecep = `rel-recep-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let userProp: string, userRecep: string;
  let contaA: string, lancRec: string, lancDesp: string;

  const ini = "2026-07-01";
  const fim = "2026-07-31";

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([{ nome: `Rel A ${sufixo}`, tipo: "medica", exibir_marketplace: false }])
      .select("id");
    clinicaA = clinicas![0].id;

    userProp = await criarUsuario(admin, emailProp, senha);
    userRecep = await criarUsuario(admin, emailRecep, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userProp, papel: "proprietario" },
      { clinica_id: clinicaA, user_id: userRecep, papel: "recepcionista" },
    ]);

    const { data: conta } = await admin
      .from("conta_bancaria").insert({ clinica_id: clinicaA, nome: `Cx ${sufixo}`, tipo: "caixa", saldo_inicial: 0 }).select("id").single();
    contaA = conta!.id;
    const { data: lancs } = await admin
      .from("lancamento_financeiro")
      .insert([
        { clinica_id: clinicaA, tipo: "receita", descricao: "R", valor: 300, data_vencimento: ini },
        { clinica_id: clinicaA, tipo: "despesa", descricao: "D", valor: 50, data_vencimento: ini },
      ])
      .select("id,tipo");
    lancRec = lancs!.find((l) => l.tipo === "receita")!.id;
    lancDesp = lancs!.find((l) => l.tipo === "despesa")!.id;

    // Baixas via RPC (geram movimentacao_conta transacionalmente)
    const sup = await clientLogado(emailProp, senha);
    await sup.rpc("registrar_baixa_lancamento", { p_clinica_id: clinicaA, p_lancamento_id: lancRec, p_conta_id: contaA, p_valor: 100, p_data: "2026-07-10", p_forma: "pix", p_obs: "" });
    await sup.rpc("registrar_baixa_lancamento", { p_clinica_id: clinicaA, p_lancamento_id: lancRec, p_conta_id: contaA, p_valor: 200, p_data: "2026-07-15", p_forma: "pix", p_obs: "" });
    await sup.rpc("registrar_baixa_lancamento", { p_clinica_id: clinicaA, p_lancamento_id: lancDesp, p_conta_id: contaA, p_valor: 50, p_data: "2026-07-12", p_forma: "pix", p_obs: "" });
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaA) await admin.from("clinica").delete().eq("id", clinicaA);
    for (const uid of [userProp, userRecep]) if (uid) await admin.auth.admin.deleteUser(uid);
  });

  it("faturamento_recebido reconcilia com movimentacao_conta e com as baixas", async () => {
    const sup = await clientLogado(emailProp, senha);
    const { data, error } = await sup.rpc("relatorio_dashboard", { p_clinica_id: clinicaA, p_ini: ini, p_fim: fim });
    expect(error).toBeNull();
    const r = data as { faturamento_recebido: number; despesas_pagas: number };
    expect(Number(r.faturamento_recebido)).toBe(300);
    expect(Number(r.despesas_pagas)).toBe(50);

    // Σ movimentacao_conta (entrada) no período
    const { data: movs } = await admin
      .from("movimentacao_conta").select("valor,tipo,data").eq("clinica_id", clinicaA);
    const entradas = (movs ?? []).filter((m) => m.tipo === "entrada").reduce((a, m) => a + Number(m.valor), 0);
    expect(entradas).toBe(300);

    // Σ baixa_lancamento das receitas
    const { data: baixas } = await admin
      .from("baixa_lancamento").select("valor,lancamento_id").eq("clinica_id", clinicaA);
    const baixasReceita = (baixas ?? []).filter((b) => b.lancamento_id === lancRec).reduce((a, b) => a + Number(b.valor), 0);
    expect(baixasReceita).toBe(300);

    // Reconciliação: os três somam igual
    expect(Number(r.faturamento_recebido)).toBe(entradas);
    expect(entradas).toBe(baixasReceita);
  });

  it("RBAC: recepcionista não lê o relatório (42501)", async () => {
    const sup = await clientLogado(emailRecep, senha);
    const { error } = await sup.rpc("relatorio_dashboard", { p_clinica_id: clinicaA, p_ini: ini, p_fim: fim });
    expect(error!.code).toBe("42501");
  });
});
