import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S2-1 (DoD): estoque-núcleo.
 *  - RLS isolamento entre clínicas + RBAC (só proprietário/gerente escrevem).
 *  - RPC registrar_saida_estoque: bloqueia saldo negativo E serializa saídas
 *    concorrentes (advisory lock) — o bloqueio do Base44 era só no cliente.
 */
describe.skipIf(!temAmbiente)("RLS: estoque-núcleo (S2-1)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let clinicaB: string;
  let userGerente: string;
  let userRecepcao: string;
  let itemA: string;
  let itemB: string;

  const emails = {
    gerente: `est-ger-${sufixo}@teste.sigo`,
    recepcao: `est-recep-${sufixo}@teste.sigo`,
  };

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinicas, error: errC } = await admin
      .from("clinica")
      .insert([
        { nome: `Clínica Est A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Clínica Est B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    if (errC) throw errC;
    [clinicaA, clinicaB] = clinicas.map((c) => c.id);

    userGerente = await criarUsuario(admin, emails.gerente, senha);
    userRecepcao = await criarUsuario(admin, emails.recepcao, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userGerente, papel: "gerente" },
      { clinica_id: clinicaA, user_id: userRecepcao, papel: "recepcionista" },
    ]);

    const { data: itens } = await admin
      .from("item_estoque")
      .insert([
        { clinica_id: clinicaA, descricao: `Botox ${sufixo}`, classificacao: "medicamento" },
        { clinica_id: clinicaB, descricao: `Item B ${sufixo}`, classificacao: "outros" },
      ])
      .select("id");
    itemA = itens![0].id;
    itemB = itens![1].id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    for (const uid of [userGerente, userRecepcao]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("staff da A não enxerga itens de estoque da B", async () => {
    const sup = await clientLogado(emails.gerente, senha);
    const { data } = await sup
      .from("item_estoque")
      .select("id")
      .in("id", [itemA, itemB]);
    expect(data!.map((r) => r.id)).toEqual([itemA]);
  });

  it("RBAC: recepcionista NÃO cria item de estoque", async () => {
    const sup = await clientLogado(emails.recepcao, senha);
    const { error } = await sup
      .from("item_estoque")
      .insert({ clinica_id: clinicaA, descricao: `Intruso ${sufixo}`, classificacao: "outros" });
    expect(error).not.toBeNull();
  });

  it("gerente registra entrada e o saldo (view) reflete", async () => {
    const sup = await clientLogado(emails.gerente, senha);
    const { error } = await sup.from("movimentacao_estoque").insert({
      clinica_id: clinicaA,
      item_id: itemA,
      tipo: "entrada",
      quantidade: 10,
      data: new Date().toISOString().slice(0, 10),
    });
    expect(error).toBeNull();

    const { data: saldo } = await sup
      .from("saldo_item_estoque")
      .select("saldo_atual")
      .eq("item_id", itemA)
      .single();
    expect(Number(saldo!.saldo_atual)).toBe(10);
  });

  it("RPC saída bloqueia saldo insuficiente", async () => {
    const sup = await clientLogado(emails.gerente, senha);
    const { error } = await sup.rpc("registrar_saida_estoque", {
      p_clinica_id: clinicaA,
      p_data: new Date().toISOString().slice(0, 10),
      p_observacao: null,
      p_linhas: [{ item_id: itemA, quantidade: 999 }],
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");
  });

  it("RBAC: recepcionista NÃO registra saída (RPC valida papel)", async () => {
    const sup = await clientLogado(emails.recepcao, senha);
    const { error } = await sup.rpc("registrar_saida_estoque", {
      p_clinica_id: clinicaA,
      p_data: new Date().toISOString().slice(0, 10),
      p_observacao: null,
      p_linhas: [{ item_id: itemA, quantidade: 1 }],
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("saída válida passa e o saldo cai", async () => {
    const sup = await clientLogado(emails.gerente, senha);
    const { error } = await sup.rpc("registrar_saida_estoque", {
      p_clinica_id: clinicaA,
      p_data: new Date().toISOString().slice(0, 10),
      p_observacao: "uso em procedimento",
      p_linhas: [{ item_id: itemA, quantidade: 4 }],
    });
    expect(error).toBeNull();

    const { data: saldo } = await sup
      .from("saldo_item_estoque")
      .select("saldo_atual")
      .eq("item_id", itemA)
      .single();
    expect(Number(saldo!.saldo_atual)).toBe(6); // 10 - 4
  });

  it("corrida: duas saídas concorrentes que juntas excedem o saldo — só uma passa", async () => {
    // saldo atual = 6. Duas saídas de 5 disparadas juntas: com o advisory lock,
    // a primeira baixa (saldo→1) e a segunda vê 1<5 e falha.
    const sup = await clientLogado(emails.gerente, senha);
    const saida = () =>
      sup.rpc("registrar_saida_estoque", {
        p_clinica_id: clinicaA,
        p_data: new Date().toISOString().slice(0, 10),
        p_observacao: "corrida",
        p_linhas: [{ item_id: itemA, quantidade: 5 }],
      });

    const [r1, r2] = await Promise.all([saida(), saida()]);
    const sucessos = [r1, r2].filter((r) => r.error == null).length;
    const falhas = [r1, r2].filter((r) => r.error != null).length;
    expect(sucessos).toBe(1);
    expect(falhas).toBe(1);

    const { data: saldo } = await sup
      .from("saldo_item_estoque")
      .select("saldo_atual")
      .eq("item_id", itemA)
      .single();
    expect(Number(saldo!.saldo_atual)).toBe(1); // 6 - 5 (só uma passou)
  });

  it("RPC saída recusa item de outra clínica", async () => {
    const sup = await clientLogado(emails.gerente, senha);
    const { error } = await sup.rpc("registrar_saida_estoque", {
      p_clinica_id: clinicaA,
      p_data: new Date().toISOString().slice(0, 10),
      p_observacao: null,
      p_linhas: [{ item_id: itemB, quantidade: 1 }], // item da clínica B
    });
    expect(error).not.toBeNull();
  });
});
