import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S1-2 (DoD): RBAC de clinica_usuario — em especial a ANTI-ESCALAÇÃO:
 * gerente gerencia o quadro mas jamais concede/atinge o papel proprietario.
 * As policies estão na migration 0300 (clinica_usuario_*).
 */
describe.skipIf(!temAmbiente)("RLS: RBAC de gestão de usuários", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaId: string;
  let userProprietario: string;
  let userGerente: string;
  let userRecepcao: string;
  let userAlvo: string; // sem vínculo inicial — alvo dos inserts
  let vinculoGerenteId: string;

  const emails = {
    proprietario: `prop-${sufixo}@teste.sigo`,
    gerente: `ger-${sufixo}@teste.sigo`,
    recepcao: `recep-${sufixo}@teste.sigo`,
    alvo: `alvo-${sufixo}@teste.sigo`,
  };

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinica, error: errClinica } = await admin
      .from("clinica")
      .insert({
        nome: `Clínica RBAC ${sufixo}`,
        tipo: "medica",
        exibir_marketplace: false,
      })
      .select("id")
      .single();
    if (errClinica) throw errClinica;
    clinicaId = clinica.id;

    userProprietario = await criarUsuario(admin, emails.proprietario, senha);
    userGerente = await criarUsuario(admin, emails.gerente, senha);
    userRecepcao = await criarUsuario(admin, emails.recepcao, senha);
    userAlvo = await criarUsuario(admin, emails.alvo, senha);

    const { data: vinculos, error: errVinculos } = await admin
      .from("clinica_usuario")
      .insert([
        { clinica_id: clinicaId, user_id: userProprietario, papel: "proprietario" },
        { clinica_id: clinicaId, user_id: userGerente, papel: "gerente" },
        { clinica_id: clinicaId, user_id: userRecepcao, papel: "recepcionista" },
      ])
      .select("id,user_id");
    if (errVinculos) throw errVinculos;
    vinculoGerenteId = vinculos.find((v) => v.user_id === userGerente)!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaId) await admin.from("clinica").delete().eq("id", clinicaId);
    for (const uid of [userProprietario, userGerente, userRecepcao, userAlvo]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("gerente NÃO concede papel proprietario (anti-escalação)", async () => {
    const sup = await clientLogado(emails.gerente, senha);
    const { error } = await sup.from("clinica_usuario").insert({
      clinica_id: clinicaId,
      user_id: userAlvo,
      papel: "proprietario",
    });

    expect(error).not.toBeNull();
  });

  it("gerente NÃO se autopromove a proprietario", async () => {
    const sup = await clientLogado(emails.gerente, senha);
    const { data, error } = await sup
      .from("clinica_usuario")
      .update({ papel: "proprietario" })
      .eq("id", vinculoGerenteId)
      .select("id");

    // UPDATE barrado (with check) — erro explícito ou zero linhas afetadas
    expect(error !== null || (data ?? []).length === 0).toBe(true);

    const { data: confer } = await admin
      .from("clinica_usuario")
      .select("papel")
      .eq("id", vinculoGerenteId)
      .single();
    expect(confer!.papel).toBe("gerente");
  });

  it("gerente convida papel abaixo de proprietario", async () => {
    const sup = await clientLogado(emails.gerente, senha);
    const { data, error } = await sup
      .from("clinica_usuario")
      .insert({
        clinica_id: clinicaId,
        user_id: userAlvo,
        papel: "recepcionista",
      })
      .select("id")
      .single();

    expect(error).toBeNull();

    // limpa para o próximo teste
    await admin.from("clinica_usuario").delete().eq("id", data!.id);
  });

  it("recepcionista NÃO gerencia o quadro de usuários", async () => {
    const sup = await clientLogado(emails.recepcao, senha);
    const { error } = await sup.from("clinica_usuario").insert({
      clinica_id: clinicaId,
      user_id: userAlvo,
      papel: "assistente",
    });

    expect(error).not.toBeNull();
  });

  it("proprietario concede qualquer papel, inclusive proprietario", async () => {
    const sup = await clientLogado(emails.proprietario, senha);
    const { data, error } = await sup
      .from("clinica_usuario")
      .insert({
        clinica_id: clinicaId,
        user_id: userAlvo,
        papel: "proprietario",
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    await admin.from("clinica_usuario").delete().eq("id", data!.id);
  });

  it("staff de outra clínica não enxerga o quadro desta", async () => {
    // recepcionista pertence à clínica — mas um usuário sem vínculo não vê nada
    const supAlvo = await clientLogado(emails.alvo, senha);
    const { data, error } = await supAlvo
      .from("clinica_usuario")
      .select("id")
      .eq("clinica_id", clinicaId)
      .neq("user_id", userAlvo);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
