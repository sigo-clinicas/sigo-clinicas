import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S1-3 (DoD): edição do cadastro da clínica é EXCLUSIVA do proprietário
 * (matriz do legado: gerente não recebia Clinica\Clinicas). Policy
 * clinica_update_proprietario (migration 0300).
 */
describe.skipIf(!temAmbiente)("RLS: configurações da clínica", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaId: string;
  let userProprietario: string;
  let userGerente: string;
  let userRecepcao: string;

  const emails = {
    proprietario: `cfg-prop-${sufixo}@teste.sigo`,
    gerente: `cfg-ger-${sufixo}@teste.sigo`,
    recepcao: `cfg-recep-${sufixo}@teste.sigo`,
  };

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinica, error } = await admin
      .from("clinica")
      .insert({
        nome: `Clínica Config ${sufixo}`,
        tipo: "medica",
        exibir_marketplace: false,
      })
      .select("id")
      .single();
    if (error) throw error;
    clinicaId = clinica.id;

    userProprietario = await criarUsuario(admin, emails.proprietario, senha);
    userGerente = await criarUsuario(admin, emails.gerente, senha);
    userRecepcao = await criarUsuario(admin, emails.recepcao, senha);

    const { error: errVinc } = await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaId, user_id: userProprietario, papel: "proprietario" },
      { clinica_id: clinicaId, user_id: userGerente, papel: "gerente" },
      { clinica_id: clinicaId, user_id: userRecepcao, papel: "recepcionista" },
    ]);
    if (errVinc) throw errVinc;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaId) await admin.from("clinica").delete().eq("id", clinicaId);
    for (const uid of [userProprietario, userGerente, userRecepcao]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("gerente NÃO edita o cadastro da clínica (matriz do legado)", async () => {
    const sup = await clientLogado(emails.gerente, senha);
    const { data } = await sup
      .from("clinica")
      .update({ nome: "Hackeada pelo gerente" })
      .eq("id", clinicaId)
      .select("id");

    expect(data ?? []).toHaveLength(0);

    const { data: confer } = await admin
      .from("clinica")
      .select("nome")
      .eq("id", clinicaId)
      .single();
    expect(confer!.nome).toBe(`Clínica Config ${sufixo}`);
  });

  it("recepcionista NÃO edita o cadastro da clínica", async () => {
    const sup = await clientLogado(emails.recepcao, senha);
    const { data } = await sup
      .from("clinica")
      .update({ tipo: "estetica" })
      .eq("id", clinicaId)
      .select("id");

    expect(data ?? []).toHaveLength(0);
  });

  it("proprietário edita dados, tipo (white-label) e config", async () => {
    const sup = await clientLogado(emails.proprietario, senha);
    const { data, error } = await sup
      .from("clinica")
      .update({
        nome: `Clínica Config ${sufixo} v2`,
        tipo: "odontologica",
        config: { base_comissao: "por_evolucao" },
      })
      .eq("id", clinicaId)
      .select("nome,tipo,config")
      .single();

    expect(error).toBeNull();
    expect(data!.nome).toBe(`Clínica Config ${sufixo} v2`);
    expect(data!.tipo).toBe("odontologica");
    expect((data!.config as { base_comissao: string }).base_comissao).toBe(
      "por_evolucao"
    );
  });
});
