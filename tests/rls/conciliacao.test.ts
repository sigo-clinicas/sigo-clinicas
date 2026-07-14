import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S3-4 — Conciliação manual. Testes obrigatórios: só proprietário/gerente
 * conciliam (policy movimentacao_conciliar); recepção e clínica alheia não;
 * a movimentação nasce da RPC de baixa (não por INSERT de UI).
 */
describe.skipIf(!temAmbiente)("Financeiro: conciliação (S3-4)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailPropA = `con-prop-a-${sufixo}@teste.sigo`;
  const emailRecepA = `con-recep-a-${sufixo}@teste.sigo`;
  const emailPropB = `con-prop-b-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaA: string, clinicaB: string;
  let userPropA: string, userRecepA: string, userPropB: string;
  let contaA: string, lancA: string, movA: string;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Con A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Con B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
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
    const { data: lanc } = await admin
      .from("lancamento_financeiro")
      .insert({ clinica_id: clinicaA, tipo: "receita", descricao: "R", valor: 100, data_vencimento: "2026-07-14" })
      .select("id")
      .single();
    lancA = lanc!.id;

    // movimentação nasce da RPC de baixa (nunca por INSERT)
    const sup = await clientLogado(emailPropA, senha);
    await sup.rpc("registrar_baixa_lancamento", {
      p_clinica_id: clinicaA, p_lancamento_id: lancA, p_conta_id: contaA,
      p_valor: 100, p_data: "2026-07-14", p_forma: "pix", p_obs: "",
    });
    const { data: mov } = await admin
      .from("movimentacao_conta").select("id").eq("lancamento_id", lancA).single();
    movA = mov!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaA) await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    for (const uid of [userPropA, userRecepA, userPropB]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("proprietário concilia (toggle do flag)", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { error } = await sup
      .from("movimentacao_conta")
      .update({ conciliada: true })
      .eq("id", movA)
      .eq("clinica_id", clinicaA);
    expect(error).toBeNull();
    const { data } = await admin
      .from("movimentacao_conta").select("conciliada").eq("id", movA).single();
    expect(data!.conciliada).toBe(true);
  });

  it("recepcionista NÃO concilia (nem lê)", async () => {
    const sup = await clientLogado(emailRecepA, senha);
    const { data: leitura } = await sup
      .from("movimentacao_conta").select("id").eq("id", movA);
    expect((leitura ?? []).length).toBe(0);
    const { data: upd } = await sup
      .from("movimentacao_conta").update({ conciliada: false }).eq("id", movA).select("id");
    expect((upd ?? []).length).toBe(0);
    const { data } = await admin
      .from("movimentacao_conta").select("conciliada").eq("id", movA).single();
    expect(data!.conciliada).toBe(true); // inalterado
  });

  it("clínica alheia não concilia a movimentação da A", async () => {
    const sup = await clientLogado(emailPropB, senha);
    const { data: upd } = await sup
      .from("movimentacao_conta").update({ conciliada: false }).eq("id", movA).select("id");
    expect((upd ?? []).length).toBe(0);
  });
});
