import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S2-2 (DoD): avaliação clínica + documentos.
 *  - Isolamento entre clínicas.
 *  - RBAC: papéis clínicos (inclui profissional) ESCREVEM; profissional NÃO
 *    deleta (retention-lock, coberto no S2-0 — aqui reconfirmamos escrita).
 */
describe.skipIf(!temAmbiente)("RLS: prontuário — avaliação e documentos (S2-2)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let clinicaB: string;
  let userProfA: string;
  let userRecepA: string;
  let userPropB: string;
  let profA: string;
  let pacienteA: string;
  let avaliacaoA: string;

  const emails = {
    profA: `pr-prof-a-${sufixo}@teste.sigo`,
    recepA: `pr-recep-a-${sufixo}@teste.sigo`,
    propB: `pr-prop-b-${sufixo}@teste.sigo`,
  };

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Clínica Pr A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Clínica Pr B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    [clinicaA, clinicaB] = clinicas!.map((c) => c.id);

    userProfA = await criarUsuario(admin, emails.profA, senha);
    userRecepA = await criarUsuario(admin, emails.recepA, senha);
    userPropB = await criarUsuario(admin, emails.propB, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userProfA, papel: "profissional" },
      { clinica_id: clinicaA, user_id: userRecepA, papel: "recepcionista" },
      { clinica_id: clinicaB, user_id: userPropB, papel: "proprietario" },
    ]);

    const { data: prof } = await admin
      .from("profissional")
      .insert({ clinica_id: clinicaA, nome: `Dr Pr ${sufixo}`, user_id: userProfA })
      .select("id")
      .single();
    profA = prof!.id;

    const { data: pac } = await admin
      .from("paciente")
      .insert({ nome: `Paciente Pr ${sufixo}` })
      .select("id")
      .single();
    pacienteA = pac!.id;
    await admin.from("paciente_clinica").insert({ clinica_id: clinicaA, paciente_id: pacienteA });
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    await admin.from("paciente").delete().eq("id", pacienteA);
    for (const uid of [userProfA, userRecepA, userPropB]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("profissional cria avaliação clínica (papel clínico escreve)", async () => {
    const sup = await clientLogado(emails.profA, senha);
    const { data, error } = await sup
      .from("avaliacao_clinica")
      .insert({
        clinica_id: clinicaA,
        paciente_id: pacienteA,
        profissional_id: profA,
        queixa_principal: "dor de cabeça",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    avaliacaoA = data!.id;
  });

  it("profissional NÃO deleta a avaliação (retention-lock)", async () => {
    const sup = await clientLogado(emails.profA, senha);
    const { data } = await sup
      .from("avaliacao_clinica")
      .delete()
      .eq("id", avaliacaoA)
      .select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("staff da B não enxerga a avaliação da A (isolamento)", async () => {
    const sup = await clientLogado(emails.propB, senha);
    const { data } = await sup
      .from("avaliacao_clinica")
      .select("id")
      .eq("id", avaliacaoA);
    expect(data).toHaveLength(0);
  });

  it("recepcionista cria documento e o assina (RBAC clínico)", async () => {
    const sup = await clientLogado(emails.recepA, senha);
    const { data: doc, error } = await sup
      .from("documento_consentimento")
      .insert({
        clinica_id: clinicaA,
        paciente_id: pacienteA,
        tipo: "tcle",
        titulo: `TCLE ${sufixo}`,
      })
      .select("id,status")
      .single();
    expect(error).toBeNull();
    expect(doc!.status).toBe("pendente");

    const { data: assinado } = await sup
      .from("documento_consentimento")
      .update({ status: "assinado", data_assinatura: new Date().toISOString() })
      .eq("id", doc!.id)
      .select("status")
      .single();
    expect(assinado!.status).toBe("assinado");
  });

  it("staff da B não enxerga documento da A", async () => {
    const supB = await clientLogado(emails.propB, senha);
    const { data } = await supB
      .from("documento_consentimento")
      .select("id")
      .eq("clinica_id", clinicaA);
    expect(data).toHaveLength(0);
  });
});
