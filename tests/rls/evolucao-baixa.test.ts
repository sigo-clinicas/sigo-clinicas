import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S2-3 (DoD): evolução clínica + ponte controlada evolução→estoque (D4).
 *
 * O núcleo é a ponte de papel: o PROFISSIONAL registra os insumos que usou na
 * sessão (evolucao_insumo — papel clínico), mas NÃO tem policy de escrita em
 * movimentacao_estoque (baixa é gestão). A baixa real só acontece pela RPC
 * baixar_insumos_evolucao (SECURITY DEFINER), que:
 *   - lado 1: comprova que o caminho direto está fechado (RLS barra);
 *   - lado 2: deixa a baixa legítima passar e o saldo cai;
 *   - é idempotente (re-baixar não duplica);
 *   - valida tenant dos dois lados (item de outra clínica é recusado);
 *   - bloqueia saldo insuficiente (igual à registrar_saida_estoque do S2-1).
 */
describe.skipIf(!temAmbiente)("RLS: evolução e baixa de insumos (S2-3)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let clinicaB: string;
  let userProf: string;
  let profA: string;
  let pacienteA: string;
  let itemA: string;
  let itemB: string;
  let evolucaoA: string;
  let insumoQ3: string;

  const emailProf = `ev-prof-${sufixo}@teste.sigo`;

  async function saldo(sup: SupabaseClient, item: string): Promise<number> {
    const { data } = await sup
      .from("saldo_item_estoque")
      .select("saldo_atual")
      .eq("item_id", item)
      .single();
    return Number(data!.saldo_atual);
  }

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Clínica Ev A ${sufixo}`, tipo: "estetica", exibir_marketplace: false },
        { nome: `Clínica Ev B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    [clinicaA, clinicaB] = clinicas!.map((c) => c.id);

    userProf = await criarUsuario(admin, emailProf, senha);
    await admin.from("clinica_usuario").insert({
      clinica_id: clinicaA,
      user_id: userProf,
      papel: "profissional",
    });

    const { data: prof } = await admin
      .from("profissional")
      .insert({ clinica_id: clinicaA, nome: `Dra Ev ${sufixo}`, user_id: userProf })
      .select("id")
      .single();
    profA = prof!.id;

    const { data: pac } = await admin
      .from("paciente")
      .insert({ nome: `Paciente Ev ${sufixo}` })
      .select("id")
      .single();
    pacienteA = pac!.id;
    await admin.from("paciente_clinica").insert({ clinica_id: clinicaA, paciente_id: pacienteA });

    const { data: itens } = await admin
      .from("item_estoque")
      .insert([
        { clinica_id: clinicaA, descricao: `Toxina ${sufixo}`, classificacao: "medicamento" },
        { clinica_id: clinicaB, descricao: `Item B ${sufixo}`, classificacao: "outros" },
      ])
      .select("id");
    itemA = itens![0].id;
    itemB = itens![1].id;

    // Entrada de 10 no itemA (setup — saldo derivado parte de 10)
    await admin.from("movimentacao_estoque").insert({
      clinica_id: clinicaA,
      item_id: itemA,
      tipo: "entrada",
      quantidade: 10,
      data: new Date().toISOString().slice(0, 10),
    });
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    await admin.from("paciente").delete().eq("id", pacienteA);
    if (userProf) await admin.auth.admin.deleteUser(userProf);
  });

  it("profissional registra evolução e insumo (papel clínico escreve)", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { data: ev, error: errEv } = await sup
      .from("evolucao_sessao")
      .insert({
        clinica_id: clinicaA,
        paciente_id: pacienteA,
        profissional_id: profA,
        descricao_atendimento: "Aplicação de toxina — região frontal",
      })
      .select("id")
      .single();
    expect(errEv).toBeNull();
    evolucaoA = ev!.id;

    const { data: ins, error: errIns } = await sup
      .from("evolucao_insumo")
      .insert({
        clinica_id: clinicaA,
        evolucao_id: evolucaoA,
        item_estoque_id: itemA,
        produto_nome: "Toxina",
        quantidade: "3 unidades",
      })
      .select("id")
      .single();
    expect(errIns).toBeNull();
    insumoQ3 = ins!.id;
  });

  it("D4 lado 1 — profissional NÃO baixa estoque direto (RLS barra movimentacao_estoque)", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { error } = await sup.from("movimentacao_estoque").insert({
      clinica_id: clinicaA,
      item_id: itemA,
      tipo: "saida",
      quantidade: 3,
      data: new Date().toISOString().slice(0, 10),
    });
    expect(error).not.toBeNull();
  });

  it("D4 lado 2 — RPC baixa o insumo legítimo e o saldo cai", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { data, error } = await sup.rpc("baixar_insumos_evolucao", {
      p_evolucao_id: evolucaoA,
    });
    expect(error).toBeNull();
    expect(data).toBe(1);
    expect(await saldo(sup, itemA)).toBe(7); // 10 - 3
  });

  it("idempotência — re-baixar a mesma evolução não duplica", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { data, error } = await sup.rpc("baixar_insumos_evolucao", {
      p_evolucao_id: evolucaoA,
    });
    expect(error).toBeNull();
    expect(data).toBe(0); // nada mais a baixar
    expect(await saldo(sup, itemA)).toBe(7);
  });

  it("saldo insuficiente — RPC recusa e nada é baixado", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { data: ins } = await sup
      .from("evolucao_insumo")
      .insert({
        clinica_id: clinicaA,
        evolucao_id: evolucaoA,
        item_estoque_id: itemA,
        produto_nome: "Toxina",
        quantidade: "999",
      })
      .select("id")
      .single();

    const { error } = await sup.rpc("baixar_insumos_evolucao", {
      p_evolucao_id: evolucaoA,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");
    expect(await saldo(sup, itemA)).toBe(7); // rollback

    await admin.from("evolucao_insumo").delete().eq("id", ins!.id);
  });

  it("isolamento — insumo apontando item de OUTRA clínica é recusado", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { data: ins } = await sup
      .from("evolucao_insumo")
      .insert({
        clinica_id: clinicaA,
        evolucao_id: evolucaoA,
        item_estoque_id: itemB, // item da clínica B
        produto_nome: "Item alheio",
        quantidade: "1",
      })
      .select("id")
      .single();

    const { error } = await sup.rpc("baixar_insumos_evolucao", {
      p_evolucao_id: evolucaoA,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");

    await admin.from("evolucao_insumo").delete().eq("id", ins!.id);
  });

  it("D5 — criar_consulta_retorno gera consulta de retorno agendada", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { data, error } = await sup.rpc("criar_consulta_retorno", {
      p_evolucao_id: evolucaoA,
      p_data_hora: "2026-09-01T14:00:00Z",
      p_duracao_minutos: 30,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    const { data: consulta } = await sup
      .from("consulta")
      .select("tipo,status,profissional_id")
      .eq("id", data as string)
      .single();
    expect(consulta!.tipo).toBe("retorno");
    expect(consulta!.status).toBe("agendado");
    expect(consulta!.profissional_id).toBe(profA);
  });

  it("remover_insumo_evolucao reverte a baixa (saldo volta)", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { error } = await sup.rpc("remover_insumo_evolucao", {
      p_insumo_id: insumoQ3,
    });
    expect(error).toBeNull();
    expect(await saldo(sup, itemA)).toBe(10); // 7 + 3 (reversão)

    const { data: sobrou } = await admin
      .from("evolucao_insumo")
      .select("id")
      .eq("id", insumoQ3);
    expect(sobrou).toHaveLength(0);
  });
});
