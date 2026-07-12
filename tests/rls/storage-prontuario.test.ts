import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S2-2 (DoD): storage policies do prontuário (migration 1100). O path começa
 * com clinica_id; um staff só grava objetos da PRÓPRIA clínica. Substitui o
 * UploadFile público do Base44 (A8) — fotos/assinaturas vão para buckets
 * privados escopados por tenant.
 */
describe.skipIf(!temAmbiente)("RLS: storage do prontuário (S2-2)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let clinicaB: string;
  let userProfA: string;

  const emailProfA = `st-prof-a-${sufixo}@teste.sigo`;
  const arquivo = new Blob(["conteudo de teste"], { type: "text/plain" });

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Clínica St A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Clínica St B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    [clinicaA, clinicaB] = clinicas!.map((c) => c.id);

    userProfA = await criarUsuario(admin, emailProfA, senha);
    await admin.from("clinica_usuario").insert({
      clinica_id: clinicaA,
      user_id: userProfA,
      papel: "profissional",
    });
  });

  afterAll(async () => {
    if (!admin) return;
    // remove objetos de teste + clínicas + usuário
    await admin.storage.from("prontuario").remove([
      `${clinicaA}/teste-${sufixo}.txt`,
    ]);
    await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    if (userProfA) await admin.auth.admin.deleteUser(userProfA);
  });

  it("staff grava no path da PRÓPRIA clínica (bucket prontuario)", async () => {
    const sup = await clientLogado(emailProfA, senha);
    const { error } = await sup.storage
      .from("prontuario")
      .upload(`${clinicaA}/teste-${sufixo}.txt`, arquivo, { upsert: true });
    expect(error).toBeNull();
  });

  it("staff NÃO grava no path de OUTRA clínica", async () => {
    const sup = await clientLogado(emailProfA, senha);
    const { error } = await sup.storage
      .from("prontuario")
      .upload(`${clinicaB}/invasao-${sufixo}.txt`, arquivo, { upsert: true });
    expect(error).not.toBeNull();
  });

  it("staff lê (signed URL) objeto da própria clínica, não de outra", async () => {
    const sup = await clientLogado(emailProfA, senha);
    const proprio = await sup.storage
      .from("prontuario")
      .createSignedUrl(`${clinicaA}/teste-${sufixo}.txt`, 60);
    expect(proprio.data?.signedUrl).toBeTruthy();

    const alheio = await sup.storage
      .from("prontuario")
      .createSignedUrl(`${clinicaB}/qualquer.txt`, 60);
    expect(alheio.data?.signedUrl).toBeFalsy();
  });
});
