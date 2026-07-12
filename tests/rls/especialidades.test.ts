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
 * S1-4 (DoD): taxonomia global (segmento→especialidade) só o admin da
 * plataforma edita; a clínica gerencia apenas a PRÓPRIA seleção
 * (clinica_especialidade); anon lê ativas (busca do marketplace).
 */
describe.skipIf(!temAmbiente)("RLS: especialidades dinâmicas", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let clinicaB: string;
  let userProprietarioA: string;
  let userAdmin: string;
  let especialidadeId: string;
  let segmentoId: string;

  const emails = {
    proprietarioA: `esp-prop-${sufixo}@teste.sigo`,
    admin: `esp-admin-${sufixo}@teste.sigo`,
  };

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinicas, error: errC } = await admin
      .from("clinica")
      .insert([
        { nome: `Clínica Esp A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Clínica Esp B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    if (errC) throw errC;
    [clinicaA, clinicaB] = clinicas.map((c) => c.id);

    userProprietarioA = await criarUsuario(admin, emails.proprietarioA, senha);
    userAdmin = await criarUsuario(admin, emails.admin, senha);

    const { error: errV } = await admin.from("clinica_usuario").insert({
      clinica_id: clinicaA,
      user_id: userProprietarioA,
      papel: "proprietario",
    });
    if (errV) throw errV;

    const { error: errA } = await admin
      .from("admin_plataforma")
      .insert({ user_id: userAdmin });
    if (errA) throw errA;

    const { data: esp, error: errE } = await admin
      .from("especialidade")
      .select("id,segmento_id")
      .limit(1)
      .single();
    if (errE) throw errE;
    especialidadeId = esp.id;
    segmentoId = esp.segmento_id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    for (const uid of [userProprietarioA, userAdmin]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("anon lê as especialidades ativas (marketplace)", async () => {
    const anon = clientAnon();
    const { data, error } = await anon
      .from("especialidade")
      .select("id")
      .limit(5);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("proprietário NÃO edita a taxonomia global", async () => {
    const sup = await clientLogado(emails.proprietarioA, senha);

    const { error: errInsert } = await sup
      .from("especialidade")
      .insert({ segmento_id: segmentoId, nome: `Invasora ${sufixo}` });
    expect(errInsert).not.toBeNull();

    const { data: updData } = await sup
      .from("especialidade")
      .update({ nome: `Renomeada ${sufixo}` })
      .eq("id", especialidadeId)
      .select("id");
    expect(updData ?? []).toHaveLength(0);
  });

  it("admin da plataforma cria e edita segmento/especialidade", async () => {
    const sup = await clientLogado(emails.admin, senha);

    const { data: seg, error: errSeg } = await sup
      .from("segmento")
      .insert({ nome: `Segmento Teste ${sufixo}` })
      .select("id")
      .single();
    expect(errSeg).toBeNull();

    const { error: errEsp } = await sup
      .from("especialidade")
      .insert({ segmento_id: seg!.id, nome: `Especialidade Teste ${sufixo}` });
    expect(errEsp).toBeNull();

    // limpeza (cascade não existe de segmento→especialidade FK restrita)
    await admin.from("especialidade").delete().eq("segmento_id", seg!.id);
    await admin.from("segmento").delete().eq("id", seg!.id);
  });

  it("proprietário gerencia a seleção da PRÓPRIA clínica", async () => {
    const sup = await clientLogado(emails.proprietarioA, senha);
    const { error } = await sup.from("clinica_especialidade").insert({
      clinica_id: clinicaA,
      especialidade_id: especialidadeId,
    });

    expect(error).toBeNull();
  });

  it("proprietário NÃO mexe na seleção de outra clínica", async () => {
    const sup = await clientLogado(emails.proprietarioA, senha);
    const { error } = await sup.from("clinica_especialidade").insert({
      clinica_id: clinicaB,
      especialidade_id: especialidadeId,
    });

    expect(error).not.toBeNull();
  });
});
