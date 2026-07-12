import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S2-0 (DoD): fundações do prontuário.
 *  D2 — trigger de isolamento paciente↔clínica: ancorar prontuário de um
 *       paciente vinculado a OUTRA clínica é RECUSADO (furo de isolamento de
 *       dado de saúde). Prioridade máxima.
 *  D1 — retention-lock: os papéis de escrita NÃO podem hard-delete registro
 *       clínico (avaliacao_clinica/evolucao_sessao/resposta_anamnese/
 *       documento_consentimento).
 */
describe.skipIf(!temAmbiente)("RLS: fundações do prontuário (S2-0)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let clinicaB: string;
  let userPropA: string;
  let userRecepA: string;
  let profA: string;
  let pacienteDaA: string; // vinculado só à A
  let pacienteDaB: string; // vinculado só à B
  let avaliacaoDaA: string;

  const emails = {
    propA: `f-prop-a-${sufixo}@teste.sigo`,
    recepA: `f-recep-a-${sufixo}@teste.sigo`,
  };

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinicas, error: errC } = await admin
      .from("clinica")
      .insert([
        { nome: `Clínica Fund A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Clínica Fund B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    if (errC) throw errC;
    [clinicaA, clinicaB] = clinicas.map((c) => c.id);

    userPropA = await criarUsuario(admin, emails.propA, senha);
    userRecepA = await criarUsuario(admin, emails.recepA, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userPropA, papel: "proprietario" },
      { clinica_id: clinicaA, user_id: userRecepA, papel: "recepcionista" },
    ]);

    const { data: prof } = await admin
      .from("profissional")
      .insert({ clinica_id: clinicaA, nome: `Dr Fund ${sufixo}` })
      .select("id")
      .single();
    profA = prof!.id;

    // pacienteDaA vinculado à A; pacienteDaB vinculado à B
    const { data: pacs } = await admin
      .from("paciente")
      .insert([
        { nome: `Paciente da A ${sufixo}` },
        { nome: `Paciente da B ${sufixo}` },
      ])
      .select("id");
    pacienteDaA = pacs![0].id;
    pacienteDaB = pacs![1].id;
    await admin.from("paciente_clinica").insert([
      { clinica_id: clinicaA, paciente_id: pacienteDaA },
      { clinica_id: clinicaB, paciente_id: pacienteDaB },
    ]);

    // avaliação legítima na A (via service_role, para o teste de retention-lock)
    const { data: av } = await admin
      .from("avaliacao_clinica")
      .insert({ clinica_id: clinicaA, paciente_id: pacienteDaA, profissional_id: profA })
      .select("id")
      .single();
    avaliacaoDaA = av!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    await admin.from("paciente").delete().in("id", [pacienteDaA, pacienteDaB]);
    for (const uid of [userPropA, userRecepA]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  // ---- D2: trigger de isolamento paciente↔clínica ----

  it("D2: staff da A NÃO ancora avaliação de paciente vinculado só à B", async () => {
    const sup = await clientLogado(emails.propA, senha);
    const { error } = await sup.from("avaliacao_clinica").insert({
      clinica_id: clinicaA,
      paciente_id: pacienteDaB, // paciente de OUTRA clínica
      profissional_id: profA,
    });
    expect(error).not.toBeNull();
  });

  it("D2: staff da A ANCORA avaliação de paciente vinculado à A", async () => {
    const sup = await clientLogado(emails.propA, senha);
    const { data, error } = await sup
      .from("avaliacao_clinica")
      .insert({
        clinica_id: clinicaA,
        paciente_id: pacienteDaA,
        profissional_id: profA,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data!.id).toBeTruthy();
  });

  it("D2: o mesmo furo é fechado na CONSULTA (agenda)", async () => {
    const sup = await clientLogado(emails.recepA, senha);
    const { error } = await sup.from("consulta").insert({
      clinica_id: clinicaA,
      paciente_id: pacienteDaB, // paciente de outra clínica
      profissional_id: profA,
      data_hora: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("D2: documento de consentimento também é isolado", async () => {
    const sup = await clientLogado(emails.propA, senha);
    const { error } = await sup.from("documento_consentimento").insert({
      clinica_id: clinicaA,
      paciente_id: pacienteDaB,
      tipo: "tcle",
      titulo: "TCLE indevido",
    });
    expect(error).not.toBeNull();
  });

  // ---- D1: retention-lock ----

  it("D1: proprietário NÃO deleta avaliação clínica (registro retido)", async () => {
    const sup = await clientLogado(emails.propA, senha);
    const { data } = await sup
      .from("avaliacao_clinica")
      .delete()
      .eq("id", avaliacaoDaA)
      .select("id");
    // sem policy de delete → 0 linhas afetadas
    expect(data ?? []).toHaveLength(0);

    const { data: aindaExiste } = await admin
      .from("avaliacao_clinica")
      .select("id")
      .eq("id", avaliacaoDaA);
    expect(aindaExiste).toHaveLength(1);
  });

  it("D1: recepcionista NÃO deleta documento de consentimento", async () => {
    const { data: doc } = await admin
      .from("documento_consentimento")
      .insert({
        clinica_id: clinicaA,
        paciente_id: pacienteDaA,
        tipo: "tcle",
        titulo: `TCLE ${sufixo}`,
      })
      .select("id")
      .single();

    const sup = await clientLogado(emails.recepA, senha);
    const { data } = await sup
      .from("documento_consentimento")
      .delete()
      .eq("id", doc!.id)
      .select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
