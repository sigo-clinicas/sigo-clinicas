import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S1-1 (DoD): usuário AUTENTICADO porém sem vínculo com clínica alguma
 * (claim `clinicas` = {}) não enxerga nenhum dado operacional. É o cenário
 * da tela SemVinculo — o RLS precisa garantir que autenticar ≠ acessar.
 */
describe.skipIf(!temAmbiente)("RLS: sessão autenticada sem vínculo", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailSemVinculo = `sem-vinculo-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaId: string;
  let userId: string;
  let pacienteId: string;

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinica, error: errClinica } = await admin
      .from("clinica")
      .insert({
        nome: `Clínica Fixture ${sufixo}`,
        tipo: "medica",
        exibir_marketplace: false,
      })
      .select("id")
      .single();
    if (errClinica) throw errClinica;
    clinicaId = clinica.id;

    const { error: errServico } = await admin
      .from("servico")
      .insert({ clinica_id: clinicaId, nome: `Serviço Fixture ${sufixo}` });
    if (errServico) throw errServico;

    const { data: pac, error: errPac } = await admin
      .from("paciente")
      .insert({ nome: `Paciente Fixture ${sufixo}` })
      .select("id")
      .single();
    if (errPac) throw errPac;
    pacienteId = pac.id;

    const { error: errVinc } = await admin
      .from("paciente_clinica")
      .insert({ clinica_id: clinicaId, paciente_id: pacienteId });
    if (errVinc) throw errVinc;

    // Usuário autenticável, mas SEM linha em clinica_usuario
    userId = await criarUsuario(admin, emailSemVinculo, senha);
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaId) await admin.from("clinica").delete().eq("id", clinicaId);
    if (pacienteId) await admin.from("paciente").delete().eq("id", pacienteId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("não lê clínicas fora do marketplace", async () => {
    const sup = await clientLogado(emailSemVinculo, senha);
    const { data, error } = await sup
      .from("clinica")
      .select("id")
      .eq("id", clinicaId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("não lê serviços", async () => {
    const sup = await clientLogado(emailSemVinculo, senha);
    const { data, error } = await sup
      .from("servico")
      .select("id")
      .eq("clinica_id", clinicaId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("não lê pacientes", async () => {
    const sup = await clientLogado(emailSemVinculo, senha);
    const { data, error } = await sup
      .from("paciente")
      .select("id")
      .eq("id", pacienteId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("não cria consulta em clínica alheia", async () => {
    const sup = await clientLogado(emailSemVinculo, senha);
    const { error } = await sup.from("consulta").insert({
      clinica_id: clinicaId,
      paciente_id: pacienteId,
      // profissional_id inexistente nem chega a importar: RLS barra antes
      profissional_id: pacienteId,
      data_hora: new Date().toISOString(),
    });

    expect(error).not.toBeNull();
  });
});
