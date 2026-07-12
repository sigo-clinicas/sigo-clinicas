import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S1-7 (DoD): paciente é GLOBAL, mas o staff só enxerga os VINCULADOS à sua
 * clínica (A1/M3). Um mesmo paciente pode estar em duas clínicas sem que uma
 * veja o vínculo da outra; recepcionista cadastra/vincula (matriz do legado).
 */
describe.skipIf(!temAmbiente)("RLS: pacientes globais e vínculo", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let clinicaB: string;
  let userRecepA: string;
  let userRecepB: string;
  let pacienteCompartilhado: string;

  const emails = {
    recepA: `pac-a-${sufixo}@teste.sigo`,
    recepB: `pac-b-${sufixo}@teste.sigo`,
  };

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinicas, error: errC } = await admin
      .from("clinica")
      .insert([
        { nome: `Clínica Pac A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Clínica Pac B ${sufixo}`, tipo: "estetica", exibir_marketplace: false },
      ])
      .select("id");
    if (errC) throw errC;
    [clinicaA, clinicaB] = clinicas.map((c) => c.id);

    userRecepA = await criarUsuario(admin, emails.recepA, senha);
    userRecepB = await criarUsuario(admin, emails.recepB, senha);

    const { error: errV } = await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userRecepA, papel: "recepcionista" },
      { clinica_id: clinicaB, user_id: userRecepB, papel: "recepcionista" },
    ]);
    if (errV) throw errV;

    // Paciente global vinculado a AMBAS as clínicas
    const { data: pac, error: errP } = await admin
      .from("paciente")
      .insert({ nome: `Paciente Compartilhado ${sufixo}`, cpf: `${Date.now()}`.slice(0, 11) })
      .select("id")
      .single();
    if (errP) throw errP;
    pacienteCompartilhado = pac.id;

    const { error: errVinc } = await admin.from("paciente_clinica").insert([
      { clinica_id: clinicaA, paciente_id: pacienteCompartilhado, origem: "Instagram" },
      { clinica_id: clinicaB, paciente_id: pacienteCompartilhado, origem: "Google" },
    ]);
    if (errVinc) throw errVinc;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    await admin.from("paciente").delete().eq("id", pacienteCompartilhado);
    for (const uid of [userRecepA, userRecepB]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("recepcionista de A vê o paciente vinculado", async () => {
    const sup = await clientLogado(emails.recepA, senha);
    const { data, error } = await sup
      .from("paciente")
      .select("id")
      .eq("id", pacienteCompartilhado);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("cada clínica só vê o PRÓPRIO vínculo (origem/convênio isolados)", async () => {
    const supA = await clientLogado(emails.recepA, senha);
    const { data: vinculosA } = await supA
      .from("paciente_clinica")
      .select("clinica_id,origem")
      .eq("paciente_id", pacienteCompartilhado);

    expect(vinculosA).toHaveLength(1);
    expect(vinculosA![0].clinica_id).toBe(clinicaA);
    expect(vinculosA![0].origem).toBe("Instagram");
  });

  it("recepcionista cadastra novo paciente e o vincula (via RPC transacional)", async () => {
    const sup = await clientLogado(emails.recepA, senha);
    const { data: novoId, error } = await sup.rpc("salvar_paciente_clinica", {
      p_clinica_id: clinicaA,
      p_paciente_id: null,
      p_dados: { nome: `Novo Paciente ${sufixo}`, ativo: true },
      p_vinculo: { origem: "Indicação" },
    });
    expect(error).toBeNull();
    expect(novoId).toBeTruthy();

    // Após vincular, a recepcionista já enxerga o paciente
    const { data } = await sup.from("paciente").select("id").eq("id", novoId);
    expect(data).toHaveLength(1);

    await admin.from("paciente").delete().eq("id", novoId as string);
  });

  it("a RPC recusa vincular à clínica onde o chamador não tem papel", async () => {
    const supB = await clientLogado(emails.recepB, senha);
    const { error } = await supB.rpc("salvar_paciente_clinica", {
      p_clinica_id: clinicaA, // clínica alheia ao recepcionista B
      p_paciente_id: null,
      p_dados: { nome: `Paciente Intruso ${sufixo}`, ativo: true },
      p_vinculo: {},
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("insert direto de paciente sem vínculo não é legível de volta (RLS)", async () => {
    // Garante que o caminho errado (insert().select()) realmente falha —
    // por isso o cadastro usa a RPC.
    const sup = await clientLogado(emails.recepA, senha);
    const { data } = await sup
      .from("paciente")
      .insert({ nome: `Sem Vínculo ${sufixo}` })
      .select("id");

    expect(data ?? []).toHaveLength(0);
  });
});
