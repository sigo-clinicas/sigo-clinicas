import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S4-1 — White-label / marca. Testes: só o PROPRIETÁRIO edita o cadastro da
 * clínica (gerente/recepcionista não — matriz do legado, policy
 * clinica_update_proprietario); isolamento entre clínicas; upload de logo só na
 * pasta da própria clínica (bucket `logos`).
 */
describe.skipIf(!temAmbiente)("White-label: RBAC clínica + storage logo (S4-1)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailProp = `wl-prop-${sufixo}@teste.sigo`;
  const emailGer = `wl-ger-${sufixo}@teste.sigo`;
  const emailPropB = `wl-propb-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaA: string, clinicaB: string;
  let userProp: string, userGer: string, userPropB: string;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `WL A ${sufixo}`, tipo: "estetica", exibir_marketplace: false },
        { nome: `WL B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    [clinicaA, clinicaB] = clinicas!.map((c) => c.id);

    userProp = await criarUsuario(admin, emailProp, senha);
    userGer = await criarUsuario(admin, emailGer, senha);
    userPropB = await criarUsuario(admin, emailPropB, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userProp, papel: "proprietario" },
      { clinica_id: clinicaA, user_id: userGer, papel: "gerente" },
      { clinica_id: clinicaB, user_id: userPropB, papel: "proprietario" },
    ]);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.storage.from("logos").remove([`${clinicaA}/logo.png`, `${clinicaB}/logo.png`]);
    if (clinicaA) await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    for (const uid of [userProp, userGer, userPropB]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("gerente NÃO edita o cadastro da clínica (só proprietário)", async () => {
    const sup = await clientLogado(emailGer, senha);
    const { data } = await sup
      .from("clinica").update({ sobre: "hack-gerente" }).eq("id", clinicaA).select("id");
    expect((data ?? []).length).toBe(0);
    const { data: c } = await admin.from("clinica").select("sobre").eq("id", clinicaA).single();
    expect(c!.sobre).not.toBe("hack-gerente");
  });

  it("proprietário edita a própria clínica (marca/slug)", async () => {
    const sup = await clientLogado(emailProp, senha);
    const { error } = await sup
      .from("clinica")
      .update({ sobre: "Clínica top", slug: `wl-a-${sufixo}`, exibir_marketplace: true })
      .eq("id", clinicaA);
    expect(error).toBeNull();
    const { data: c } = await admin.from("clinica").select("sobre,slug").eq("id", clinicaA).single();
    expect(c!.sobre).toBe("Clínica top");
  });

  it("proprietário NÃO edita clínica de outra empresa", async () => {
    const supB = await clientLogado(emailPropB, senha);
    const { data } = await supB
      .from("clinica").update({ sobre: "invasao" }).eq("id", clinicaA).select("id");
    expect((data ?? []).length).toBe(0);
  });

  it("logo: sobe só na pasta da própria clínica (bucket logos)", async () => {
    const sup = await clientLogado(emailProp, senha);
    const bin = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const okUp = await sup.storage
      .from("logos").upload(`${clinicaA}/logo.png`, bin, { upsert: true, contentType: "image/png" });
    expect(okUp.error).toBeNull();
    const badUp = await sup.storage
      .from("logos").upload(`${clinicaB}/logo.png`, bin, { upsert: true, contentType: "image/png" });
    expect(badUp.error).not.toBeNull(); // pasta de outra clínica
  });
});
