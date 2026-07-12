import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S1-5 (DoD): profissional edita o PRÓPRIO cadastro e os PRÓPRIOS intervalos
 * (policies profissional_update_proprio / intervalo_profissional_proprio),
 * mas não cria profissionais nem mexe nos colegas; isolamento entre clínicas.
 */
describe.skipIf(!temAmbiente)("RLS: profissionais e intervalos", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaId: string;
  let userProf: string;
  let profissionalProprio: string;
  let profissionalColega: string;

  const emailProf = `prof-${sufixo}@teste.sigo`;

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinica, error: errC } = await admin
      .from("clinica")
      .insert({ nome: `Clínica Prof ${sufixo}`, tipo: "medica", exibir_marketplace: false })
      .select("id")
      .single();
    if (errC) throw errC;
    clinicaId = clinica.id;

    userProf = await criarUsuario(admin, emailProf, senha);

    const { error: errV } = await admin.from("clinica_usuario").insert({
      clinica_id: clinicaId,
      user_id: userProf,
      papel: "profissional",
    });
    if (errV) throw errV;

    const { data: profs, error: errP } = await admin
      .from("profissional")
      .insert([
        { clinica_id: clinicaId, nome: `Dra Própria ${sufixo}`, user_id: userProf },
        { clinica_id: clinicaId, nome: `Dr Colega ${sufixo}` },
      ])
      .select("id,user_id");
    if (errP) throw errP;
    profissionalProprio = profs.find((p) => p.user_id === userProf)!.id;
    profissionalColega = profs.find((p) => p.user_id === null)!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaId) await admin.from("clinica").delete().eq("id", clinicaId);
    if (userProf) await admin.auth.admin.deleteUser(userProf);
  });

  it("profissional lê a equipe da clínica", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { data, error } = await sup
      .from("profissional")
      .select("id")
      .eq("clinica_id", clinicaId);

    expect(error).toBeNull();
    expect(data!.length).toBe(2);
  });

  it("profissional NÃO cria novos profissionais (cadastro é gestão)", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { error } = await sup
      .from("profissional")
      .insert({ clinica_id: clinicaId, nome: `Intruso ${sufixo}` });

    expect(error).not.toBeNull();
  });

  it("profissional atualiza o próprio cadastro", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { data, error } = await sup
      .from("profissional")
      .update({ telefone: "(11) 99999-0000" })
      .eq("id", profissionalProprio)
      .select("telefone")
      .single();

    expect(error).toBeNull();
    expect(data!.telefone).toBe("(11) 99999-0000");
  });

  it("profissional NÃO atualiza o cadastro do colega", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { data } = await sup
      .from("profissional")
      .update({ telefone: "(11) 88888-1111" })
      .eq("id", profissionalColega)
      .select("id");

    expect(data ?? []).toHaveLength(0);
  });

  it("profissional gerencia os próprios intervalos", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { error } = await sup.from("profissional_intervalo").insert({
      clinica_id: clinicaId,
      profissional_id: profissionalProprio,
      tipo: "fixo",
      motivo: "Almoço",
      dia_semana: 2,
      hora_inicio: "12:00",
      hora_fim: "13:00",
    });

    expect(error).toBeNull();
  });

  it("profissional NÃO cria intervalo para o colega", async () => {
    const sup = await clientLogado(emailProf, senha);
    const { error } = await sup.from("profissional_intervalo").insert({
      clinica_id: clinicaId,
      profissional_id: profissionalColega,
      tipo: "fixo",
      motivo: "Sabotagem",
      dia_semana: 3,
      hora_inicio: "08:00",
      hora_fim: "18:00",
    });

    expect(error).not.toBeNull();
  });

  it("check constraint: intervalo fixo exige dia/horas", async () => {
    const { error } = await admin.from("profissional_intervalo").insert({
      clinica_id: clinicaId,
      profissional_id: profissionalProprio,
      tipo: "fixo",
      motivo: "Inválido",
    });

    expect(error).not.toBeNull();
  });
});
