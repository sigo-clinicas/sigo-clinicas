import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAnon, clientLogado, clientServiceRole, criarUsuario, temAmbiente } from "./helpers";

/**
 * S5 — clinica_horario (horário de funcionamento). Vitrine pública + RBAC de
 * escrita. Cobre: (a) anon lê de clínica pública, (b) anon não lê de não-pública,
 * (c) staff de OUTRA clínica não escreve, (d) recepcionista não escreve,
 * (e) proprietário/gerente da própria clínica escrevem.
 */
describe.skipIf(!temAmbiente)("S5 — clinica_horario (horário de funcionamento)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailGerenteA = `ger-a-${sufixo}@teste.sigo`;
  const emailRecepA = `rec-a-${sufixo}@teste.sigo`;
  const emailPropB = `prop-b-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaPub: string, clinicaPriv: string;
  let uGerenteA: string, uRecepA: string, uPropB: string;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas, error } = await admin
      .from("clinica")
      .insert([
        { nome: `Hor Pub ${sufixo}`, slug: `hor-pub-${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: true },
        { nome: `Hor Priv ${sufixo}`, slug: `hor-priv-${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: false },
      ])
      .select("id");
    if (error) throw error;
    [clinicaPub, clinicaPriv] = clinicas!.map((c) => c.id);

    // horário na pública (seg-sex 09-18) e na privada (para provar isolamento)
    const linhas = (cid: string) =>
      [1, 2, 3, 4, 5].map((d) => ({ clinica_id: cid, dia_semana: d, abertura: "09:00", fechamento: "18:00" }));
    const { error: eH } = await admin.from("clinica_horario").insert([...linhas(clinicaPub), ...linhas(clinicaPriv)]);
    if (eH) throw eH;

    uGerenteA = await criarUsuario(admin, emailGerenteA, senha);
    uRecepA = await criarUsuario(admin, emailRecepA, senha);
    uPropB = await criarUsuario(admin, emailPropB, senha);
    const { error: eV } = await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaPub, user_id: uGerenteA, papel: "gerente" },
      { clinica_id: clinicaPub, user_id: uRecepA, papel: "recepcionista" },
      { clinica_id: clinicaPriv, user_id: uPropB, papel: "proprietario" },
    ]);
    if (eV) throw eV;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaPub) await admin.from("clinica").delete().in("id", [clinicaPub, clinicaPriv]);
    for (const uid of [uGerenteA, uRecepA, uPropB]) if (uid) await admin.auth.admin.deleteUser(uid);
  });

  it("anon lê o horário de clínica pública", async () => {
    const anon = clientAnon();
    const { data, error } = await anon
      .from("clinica_horario")
      .select("dia_semana,abertura,fechamento")
      .eq("clinica_id", clinicaPub)
      .order("dia_semana");
    expect(error).toBeNull();
    expect(data!.length).toBe(5);
    expect(data![0].dia_semana).toBe(1);
  });

  it("anon NÃO lê o horário de clínica não-pública (RLS filtra)", async () => {
    const anon = clientAnon();
    const { data } = await anon
      .from("clinica_horario")
      .select("dia_semana")
      .eq("clinica_id", clinicaPriv);
    expect(data ?? []).toEqual([]);
  });

  it("gerente da própria clínica escreve (update)", async () => {
    const sup = await clientLogado(emailGerenteA, senha);
    const { data, error } = await sup
      .from("clinica_horario")
      .update({ fechamento: "19:00" })
      .eq("clinica_id", clinicaPub)
      .eq("dia_semana", 1)
      .select("id");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it("recepcionista NÃO escreve (RBAC: só proprietário/gerente)", async () => {
    const sup = await clientLogado(emailRecepA, senha);
    const { data } = await sup
      .from("clinica_horario")
      .update({ fechamento: "20:00" })
      .eq("clinica_id", clinicaPub)
      .eq("dia_semana", 2)
      .select("id");
    expect(data ?? []).toHaveLength(0); // RLS bloqueia, nada afetado
  });

  it("staff de OUTRA clínica NÃO escreve na clínica pública (isolamento)", async () => {
    const sup = await clientLogado(emailPropB, senha); // proprietário da privada
    const { data } = await sup
      .from("clinica_horario")
      .update({ fechamento: "21:00" })
      .eq("clinica_id", clinicaPub)
      .eq("dia_semana", 3)
      .select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("anon NÃO escreve (sem policy de insert p/ anon)", async () => {
    const anon = clientAnon();
    const { error } = await anon
      .from("clinica_horario")
      .insert({ clinica_id: clinicaPub, dia_semana: 6, abertura: "10:00", fechamento: "14:00" });
    expect(error).not.toBeNull();
  });
});
