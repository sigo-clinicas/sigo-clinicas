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
 * S4-2 — Depoimentos. Testes: RBAC (recepção não escreve), isolamento,
 * EXPOSIÇÃO pública (anon só vê aprovado+publicar de clínica pública) e
 * RECONCILIAÇÃO com o ranking (nota de aprovado+publicado entra em
 * marketplace_ranking_score).
 */
describe.skipIf(!temAmbiente)("Marketing: depoimentos (S4-2)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailProp = `dep-prop-${sufixo}@teste.sigo`;
  const emailRecep = `dep-recep-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaPub: string, clinicaPriv: string;
  let userProp: string, userRecep: string;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `DepPub ${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: true },
        { nome: `DepPriv ${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: false },
      ])
      .select("id");
    [clinicaPub, clinicaPriv] = clinicas!.map((c) => c.id);

    userProp = await criarUsuario(admin, emailProp, senha);
    userRecep = await criarUsuario(admin, emailRecep, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaPub, user_id: userProp, papel: "proprietario" },
      { clinica_id: clinicaPub, user_id: userRecep, papel: "recepcionista" },
    ]);

    await admin.from("depoimento").insert([
      { clinica_id: clinicaPub, paciente_nome: "Ana", texto: "Ótimo", nota: 5, status: "aprovado", publicar_no_site: true },
      { clinica_id: clinicaPub, paciente_nome: "Bia", texto: "Pendente", nota: 1, status: "pendente", publicar_no_site: false },
      { clinica_id: clinicaPriv, paciente_nome: "Cadu", texto: "Privado", nota: 5, status: "aprovado", publicar_no_site: true },
    ]);
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaPub) await admin.from("clinica").delete().in("id", [clinicaPub, clinicaPriv]);
    for (const uid of [userProp, userRecep]) if (uid) await admin.auth.admin.deleteUser(uid);
  });

  it("RBAC: recepcionista NÃO cria depoimento; proprietário cria", async () => {
    const recep = await clientLogado(emailRecep, senha);
    const bloqueado = await recep
      .from("depoimento")
      .insert({ clinica_id: clinicaPub, paciente_nome: "X", texto: "y", status: "pendente" });
    expect(bloqueado.error).not.toBeNull();

    const prop = await clientLogado(emailProp, senha);
    const ok = await prop
      .from("depoimento")
      .insert({ clinica_id: clinicaPub, paciente_nome: "Prop", texto: "criado", status: "pendente" });
    expect(ok.error).toBeNull();
  });

  it("exposição pública: anon só vê aprovado+publicar de clínica pública", async () => {
    const anon = clientAnon();
    const { data } = await anon
      .from("depoimento")
      .select("paciente_nome,status,publicar_no_site,clinica_id")
      .in("clinica_id", [clinicaPub, clinicaPriv]);
    const vistos = data ?? [];
    expect(vistos.every((d) => d.status === "aprovado" && d.publicar_no_site)).toBe(true);
    expect(vistos.every((d) => d.clinica_id === clinicaPub)).toBe(true); // não vaza a privada
    expect(vistos.some((d) => d.status === "pendente")).toBe(false);
  });

  it("ranking reconcilia: nota de aprovado+publicado entra no score", async () => {
    const anon = clientAnon();
    const { data } = await anon.rpc("marketplace_ranking_score", { p_clinica_id: clinicaPub });
    // score_manual 0 + média das notas aprovadas+publicadas (só a nota 5) = 5
    expect(Number(data)).toBe(5);
  });

  it("isolamento: clínica não vê depoimento de outra", async () => {
    const prop = await clientLogado(emailProp, senha);
    const { data } = await prop
      .from("depoimento").select("id,clinica_id").eq("clinica_id", clinicaPriv);
    expect((data ?? []).length).toBe(0);
  });
});
