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
 * Isolamento entre clínicas + RBAC por papel — o teste que faltou ao legado
 * (R12) e que o CLAUDE.md §5 torna obrigatório. Modelo para os testes de
 * policy de todas as próximas tabelas.
 *
 * Cenário: clínica A (proprietária + recepcionista) e clínica B
 * (proprietária). Serviços em ambas; paciente vinculado só à A.
 */
describe.skipIf(!temAmbiente)("RLS: isolamento entre clínicas", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let clinicaB: string;
  let userProprietariaA: string;
  let userProprietariaB: string;
  let userRecepcaoA: string;
  let pacienteA: string;

  const emailProprietariaA = `prop-a-${sufixo}@teste.sigo`;
  const emailProprietariaB = `prop-b-${sufixo}@teste.sigo`;
  const emailRecepcaoA = `recep-a-${sufixo}@teste.sigo`;

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinicas, error: errClinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Clínica A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Clínica B ${sufixo}`, tipo: "estetica", exibir_marketplace: false },
      ])
      .select("id");
    if (errClinicas) throw errClinicas;
    [clinicaA, clinicaB] = clinicas.map((c) => c.id);

    userProprietariaA = await criarUsuario(admin, emailProprietariaA, senha);
    userProprietariaB = await criarUsuario(admin, emailProprietariaB, senha);
    userRecepcaoA = await criarUsuario(admin, emailRecepcaoA, senha);

    const { error: errVinculos } = await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userProprietariaA, papel: "proprietario" },
      { clinica_id: clinicaB, user_id: userProprietariaB, papel: "proprietario" },
      { clinica_id: clinicaA, user_id: userRecepcaoA, papel: "recepcionista" },
    ]);
    if (errVinculos) throw errVinculos;

    const { error: errServicos } = await admin.from("servico").insert([
      { clinica_id: clinicaA, nome: "Consulta Clínica A" },
      { clinica_id: clinicaB, nome: "Limpeza de Pele Clínica B" },
    ]);
    if (errServicos) throw errServicos;

    const { data: pac, error: errPaciente } = await admin
      .from("paciente")
      .insert({ nome: `Paciente da A ${sufixo}` })
      .select("id")
      .single();
    if (errPaciente) throw errPaciente;
    pacienteA = pac.id;

    const { error: errVinculoPac } = await admin
      .from("paciente_clinica")
      .insert({ clinica_id: clinicaA, paciente_id: pacienteA });
    if (errVinculoPac) throw errVinculoPac;
  });

  afterAll(async () => {
    if (!admin) return; // beforeAll falhou antes de criar dados — nada a limpar
    // Cascade limpa vínculos/serviços; usuários e paciente saem explicitamente.
    if (clinicaA) {
      await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    }
    if (pacienteA) {
      await admin.from("paciente").delete().eq("id", pacienteA);
    }
    for (const uid of [userProprietariaA, userProprietariaB, userRecepcaoA]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("staff da clínica A só enxerga serviços da clínica A", async () => {
    const supA = await clientLogado(emailProprietariaA, senha);
    const { data, error } = await supA.from("servico").select("clinica_id");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((s) => s.clinica_id === clinicaA)).toBe(true);
  });

  it("staff da clínica A não consegue inserir serviço na clínica B", async () => {
    const supA = await clientLogado(emailProprietariaA, senha);
    const { error } = await supA
      .from("servico")
      .insert({ clinica_id: clinicaB, nome: `Invasão ${sufixo}` });

    expect(error).not.toBeNull(); // RLS with check viola (42501)
  });

  it("anon não lê serviços que não são públicos de marketplace", async () => {
    const anon = clientAnon();
    const { data, error } = await anon
      .from("servico")
      .select("id")
      .in("clinica_id", [clinicaA, clinicaB]);

    expect(error).toBeNull(); // RLS não erra em SELECT — filtra
    expect(data).toHaveLength(0);
  });

  it("staff da clínica B não enxerga paciente vinculado apenas à clínica A", async () => {
    const supB = await clientLogado(emailProprietariaB, senha);
    const { data, error } = await supB
      .from("paciente")
      .select("id")
      .eq("id", pacienteA);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("RBAC: recepcionista não cria serviço (cadastro é de proprietário/gerente)", async () => {
    const supRecep = await clientLogado(emailRecepcaoA, senha);
    const { error } = await supRecep
      .from("servico")
      .insert({ clinica_id: clinicaA, nome: `Serviço da recepção ${sufixo}` });

    expect(error).not.toBeNull();
  });

  it("RBAC: recepcionista lê os serviços da própria clínica", async () => {
    const supRecep = await clientLogado(emailRecepcaoA, senha);
    const { data, error } = await supRecep.from("servico").select("clinica_id");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((s) => s.clinica_id === clinicaA)).toBe(true);
  });
});
