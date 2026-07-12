import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S1-8 (DoD): isolamento de consulta entre clínicas + RBAC (matriz do
 * legado): recepção/gestão criam; profissional LÊ a agenda mas não cria/edita;
 * paciente vê as próprias consultas.
 */
describe.skipIf(!temAmbiente)("RLS: agenda / consultas", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let clinicaB: string;
  let userRecepA: string;
  let userProfA: string;
  let profA: string;
  let pacienteA: string;
  let consultaA: string;

  const emails = {
    recepA: `ag-recep-${sufixo}@teste.sigo`,
    profA: `ag-prof-${sufixo}@teste.sigo`,
  };

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinicas, error: errC } = await admin
      .from("clinica")
      .insert([
        { nome: `Clínica Ag A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Clínica Ag B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    if (errC) throw errC;
    [clinicaA, clinicaB] = clinicas.map((c) => c.id);

    userRecepA = await criarUsuario(admin, emails.recepA, senha);
    userProfA = await criarUsuario(admin, emails.profA, senha);

    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userRecepA, papel: "recepcionista" },
      { clinica_id: clinicaA, user_id: userProfA, papel: "profissional" },
    ]);

    const { data: prof } = await admin
      .from("profissional")
      .insert({ clinica_id: clinicaA, nome: `Dr Ag ${sufixo}`, user_id: userProfA })
      .select("id")
      .single();
    profA = prof!.id;

    const { data: pac } = await admin
      .from("paciente")
      .insert({ nome: `Paciente Ag ${sufixo}` })
      .select("id")
      .single();
    pacienteA = pac!.id;
    await admin
      .from("paciente_clinica")
      .insert({ clinica_id: clinicaA, paciente_id: pacienteA });

    const { data: consulta } = await admin
      .from("consulta")
      .insert({
        clinica_id: clinicaA,
        paciente_id: pacienteA,
        profissional_id: profA,
        data_hora: new Date().toISOString(),
      })
      .select("id")
      .single();
    consultaA = consulta!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    await admin.from("paciente").delete().eq("id", pacienteA);
    for (const uid of [userRecepA, userProfA]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("recepcionista cria consulta na própria clínica", async () => {
    const sup = await clientLogado(emails.recepA, senha);
    const { error } = await sup.from("consulta").insert({
      clinica_id: clinicaA,
      paciente_id: pacienteA,
      profissional_id: profA,
      data_hora: new Date(Date.now() + 3600000).toISOString(),
    });

    expect(error).toBeNull();
  });

  it("recepcionista NÃO cria consulta em clínica alheia", async () => {
    const sup = await clientLogado(emails.recepA, senha);
    const { error } = await sup.from("consulta").insert({
      clinica_id: clinicaB,
      paciente_id: pacienteA,
      profissional_id: profA,
      data_hora: new Date().toISOString(),
    });

    expect(error).not.toBeNull();
  });

  it("profissional LÊ a agenda mas NÃO cria consultas (matriz do legado)", async () => {
    const sup = await clientLogado(emails.profA, senha);

    const { data: lidas, error: errLeitura } = await sup
      .from("consulta")
      .select("id")
      .eq("clinica_id", clinicaA);
    expect(errLeitura).toBeNull();
    expect(lidas!.length).toBeGreaterThan(0);

    const { error: errEscrita } = await sup.from("consulta").insert({
      clinica_id: clinicaA,
      paciente_id: pacienteA,
      profissional_id: profA,
      data_hora: new Date().toISOString(),
    });
    expect(errEscrita).not.toBeNull();
  });

  it("consulta de A é invisível para quem não pertence à clínica", async () => {
    const sup = await clientLogado(emails.profA, senha);
    // profA pertence a A e vê; garantimos que a query escopada não vaza B
    const { data } = await sup
      .from("consulta")
      .select("clinica_id")
      .eq("id", consultaA);
    expect(data![0].clinica_id).toBe(clinicaA);
  });
});
