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
 * S3-6 — Cupons (painel) + destaque/ranqueamento. Testes obrigatórios: RLS/RBAC
 * do cupom; EXPOSIÇÃO PÚBLICA (anon só vê cupom 'ativo' de clínica pública);
 * destaque escrito só por admin; marketplace_ranking_score neutro por default.
 */
describe.skipIf(!temAmbiente)("Marketing: cupons + destaque (S3-6)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailProp = `mkt-prop-${sufixo}@teste.sigo`;
  const emailRecep = `mkt-recep-${sufixo}@teste.sigo`;
  const emailAdmin = `mkt-admin-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaPub: string, clinicaPriv: string;
  let userProp: string, userRecep: string, userAdmin: string;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Pub ${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: true },
        { nome: `Priv ${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: false },
      ])
      .select("id");
    [clinicaPub, clinicaPriv] = clinicas!.map((c) => c.id);

    userProp = await criarUsuario(admin, emailProp, senha);
    userRecep = await criarUsuario(admin, emailRecep, senha);
    userAdmin = await criarUsuario(admin, emailAdmin, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaPub, user_id: userProp, papel: "proprietario" },
      { clinica_id: clinicaPub, user_id: userRecep, papel: "recepcionista" },
    ]);
    await admin.from("admin_plataforma").insert({ user_id: userAdmin });

    await admin.from("cupom").insert([
      { clinica_id: clinicaPub, codigo: `ATIVO-${sufixo}`, tipo_desconto: "percentual", valor_desconto: 10, status: "ativo", quantidade_usos: 1 },
      { clinica_id: clinicaPub, codigo: `PEND-${sufixo}`, tipo_desconto: "percentual", valor_desconto: 5, status: "pendente", quantidade_usos: 1 },
      { clinica_id: clinicaPriv, codigo: `PRIV-${sufixo}`, tipo_desconto: "valor", valor_desconto: 20, status: "ativo", quantidade_usos: 1 },
    ]);
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaPub) await admin.from("clinica").delete().in("id", [clinicaPub, clinicaPriv]);
    await admin.from("admin_plataforma").delete().eq("user_id", userAdmin);
    for (const uid of [userProp, userRecep, userAdmin]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  it("anon só vê cupom 'ativo' de clínica pública", async () => {
    const anon = clientAnon();
    const { data } = await anon
      .from("cupom")
      .select("codigo,status,clinica_id")
      .in("clinica_id", [clinicaPub, clinicaPriv]);
    const vistos = data ?? [];
    expect(vistos.every((c) => c.status === "ativo" && c.clinica_id === clinicaPub)).toBe(true);
    // não vê o pendente nem o da clínica privada
    expect(vistos.some((c) => c.status === "pendente")).toBe(false);
    expect(vistos.some((c) => c.clinica_id === clinicaPriv)).toBe(false);
  });

  it("RBAC: recepcionista NÃO cria cupom; proprietário cria", async () => {
    const recep = await clientLogado(emailRecep, senha);
    const bloqueado = await recep.from("cupom").insert({
      clinica_id: clinicaPub, codigo: `X-${sufixo}`, tipo_desconto: "percentual",
      valor_desconto: 10, status: "ativo", quantidade_usos: 1,
    });
    expect(bloqueado.error).not.toBeNull();

    const prop = await clientLogado(emailProp, senha);
    const ok = await prop.from("cupom").insert({
      clinica_id: clinicaPub, codigo: `OK-${sufixo}`, tipo_desconto: "percentual",
      valor_desconto: 10, status: "ativo", quantidade_usos: 1,
    });
    expect(ok.error).toBeNull();
  });

  it("proprietário não cria cupom em clínica alheia (WITH CHECK)", async () => {
    const prop = await clientLogado(emailProp, senha);
    const { error } = await prop.from("cupom").insert({
      clinica_id: clinicaPriv, codigo: `HACK-${sufixo}`, tipo_desconto: "percentual",
      valor_desconto: 10, status: "ativo", quantidade_usos: 1,
    });
    expect(error).not.toBeNull();
  });

  it("destaque: só admin escreve; anon lê o de clínica pública", async () => {
    // não-admin (proprietário) não escreve
    const prop = await clientLogado(emailProp, senha);
    const negado = await prop.from("clinica_destaque").insert({
      clinica_id: clinicaPub, nivel: "premium", score_manual: 99,
    });
    expect(negado.error).not.toBeNull();

    // admin escreve
    const adminUser = await clientLogado(emailAdmin, senha);
    const ok = await adminUser.from("clinica_destaque").upsert(
      { clinica_id: clinicaPub, nivel: "parceiro", score_manual: 5, ativo: true },
      { onConflict: "clinica_id" }
    );
    expect(ok.error).toBeNull();

    // anon lê destaque de clínica pública
    const anon = clientAnon();
    const { data } = await anon
      .from("clinica_destaque")
      .select("clinica_id,nivel,score_manual")
      .eq("clinica_id", clinicaPub)
      .maybeSingle();
    expect(data).not.toBeNull();
    expect(data!.score_manual).toBe(5);
  });

  it("marketplace_ranking_score: default neutro; reflete score_manual", async () => {
    const anon = clientAnon();
    // clinicaPub tem score_manual 5 (do teste anterior) e sem depoimentos → 5
    const { data: sPub } = await anon.rpc("marketplace_ranking_score", {
      p_clinica_id: clinicaPub,
    });
    expect(Number(sPub)).toBe(5);

    // clínica sem destaque nem depoimento → neutro (0)
    const { data: sPriv } = await anon.rpc("marketplace_ranking_score", {
      p_clinica_id: clinicaPriv,
    });
    expect(Number(sPriv)).toBe(0);
  });
});
