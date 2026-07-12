import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientAnon,
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S1-6 (DoD): tabelas de preço/convênios são cadastro de gestão
 * (proprietário/gerente); constraint de integridade do item (fixo exige
 * valor; gratuito dispensa); marketplace anon só vê o que é público.
 */
describe.skipIf(!temAmbiente)("RLS: serviços, tabelas de preço e convênios", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaId: string;
  let userGerente: string;
  let userRecepcao: string;
  let servicoId: string;

  const emails = {
    gerente: `svc-ger-${sufixo}@teste.sigo`,
    recepcao: `svc-recep-${sufixo}@teste.sigo`,
  };

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinica, error: errC } = await admin
      .from("clinica")
      .insert({
        nome: `Clínica Preços ${sufixo}`,
        tipo: "medica",
        exibir_marketplace: true,
        ativo: true,
      })
      .select("id")
      .single();
    if (errC) throw errC;
    clinicaId = clinica.id;

    userGerente = await criarUsuario(admin, emails.gerente, senha);
    userRecepcao = await criarUsuario(admin, emails.recepcao, senha);

    const { error: errV } = await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaId, user_id: userGerente, papel: "gerente" },
      { clinica_id: clinicaId, user_id: userRecepcao, papel: "recepcionista" },
    ]);
    if (errV) throw errV;

    const { data: servico, error: errS } = await admin
      .from("servico")
      .insert({
        clinica_id: clinicaId,
        nome: `Consulta ${sufixo}`,
        exibir_publico: true,
      })
      .select("id")
      .single();
    if (errS) throw errS;
    servicoId = servico.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaId) await admin.from("clinica").delete().eq("id", clinicaId);
    for (const uid of [userGerente, userRecepcao]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("gerente cria tabela de preço com itens", async () => {
    const sup = await clientLogado(emails.gerente, senha);
    const { data: tabela, error: errT } = await sup
      .from("tabela_preco")
      .insert({
        clinica_id: clinicaId,
        nome: `Particular ${sufixo}`,
        exibir_publico: true,
      })
      .select("id")
      .single();
    expect(errT).toBeNull();

    const { error: errI } = await sup.from("item_tabela_preco").insert({
      clinica_id: clinicaId,
      tabela_preco_id: tabela!.id,
      servico_id: servicoId,
      tipo_valor: "fixo",
      valor: 250,
    });
    expect(errI).toBeNull();
  });

  it("recepcionista NÃO cria tabela de preço", async () => {
    const sup = await clientLogado(emails.recepcao, senha);
    const { error } = await sup.from("tabela_preco").insert({
      clinica_id: clinicaId,
      nome: `Tabela da recepção ${sufixo}`,
    });

    expect(error).not.toBeNull();
  });

  it("constraint: item fixo sem valor falha; gratuito sem valor passa", async () => {
    const { data: tabela } = await admin
      .from("tabela_preco")
      .insert({ clinica_id: clinicaId, nome: `Constraint ${sufixo}` })
      .select("id")
      .single();

    const { error: errFixo } = await admin.from("item_tabela_preco").insert({
      clinica_id: clinicaId,
      tabela_preco_id: tabela!.id,
      servico_id: servicoId,
      tipo_valor: "fixo",
      valor: null,
    });
    expect(errFixo).not.toBeNull(); // check constraint

    const { error: errGratis } = await admin.from("item_tabela_preco").insert({
      clinica_id: clinicaId,
      tabela_preco_id: tabela!.id,
      servico_id: servicoId,
      tipo_valor: "gratuito",
      valor: null,
    });
    expect(errGratis).toBeNull();
  });

  it("recepcionista NÃO cria convênio; gerente cria", async () => {
    const supRecep = await clientLogado(emails.recepcao, senha);
    const { error: errRecep } = await supRecep.from("convenio").insert({
      clinica_id: clinicaId,
      nome: `Convênio recepção ${sufixo}`,
    });
    expect(errRecep).not.toBeNull();

    const supGer = await clientLogado(emails.gerente, senha);
    const { error: errGer } = await supGer.from("convenio").insert({
      clinica_id: clinicaId,
      nome: `Unimed ${sufixo}`,
      tipo: "plano_saude",
    });
    expect(errGer).toBeNull();
  });

  it("anon vê serviço público de clínica visível no marketplace", async () => {
    const anon = clientAnon();
    const { data, error } = await anon
      .from("servico")
      .select("id")
      .eq("id", servicoId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
