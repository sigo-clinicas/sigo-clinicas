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
 * S4-2 — Sala VIP. Testes: RBAC (recepção não escreve), isolamento, EXPOSIÇÃO
 * pública (anon só vê sala aprovada+ativa de clínica pública; NUNCA lê os
 * interessados lead_sala_vip).
 */
describe.skipIf(!temAmbiente)("Marketing: sala VIP (S4-2)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailProp = `svip-prop-${sufixo}@teste.sigo`;
  const emailRecep = `svip-recep-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaPub: string, clinicaPriv: string;
  let userProp: string, userRecep: string;
  let salaAprov: string;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `SvPub ${sufixo}`, tipo: "estetica", ativo: true, exibir_marketplace: true },
        { nome: `SvPriv ${sufixo}`, tipo: "estetica", ativo: true, exibir_marketplace: false },
      ])
      .select("id");
    [clinicaPub, clinicaPriv] = clinicas!.map((c) => c.id);

    userProp = await criarUsuario(admin, emailProp, senha);
    userRecep = await criarUsuario(admin, emailRecep, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaPub, user_id: userProp, papel: "proprietario" },
      { clinica_id: clinicaPub, user_id: userRecep, papel: "recepcionista" },
    ]);

    const { data: salas } = await admin
      .from("sala_vip")
      .insert([
        { clinica_id: clinicaPub, nome: `Aprovada ${sufixo}`, status: "aprovada", ativa: true },
        { clinica_id: clinicaPub, nome: `Pendente ${sufixo}`, status: "pendente", ativa: true },
        { clinica_id: clinicaPriv, nome: `Priv ${sufixo}`, status: "aprovada", ativa: true },
      ])
      .select("id,nome");
    salaAprov = salas!.find((s) => s.nome.startsWith("Aprovada"))!.id;

    await admin.from("lead_sala_vip").insert({
      clinica_id: clinicaPub, sala_vip_id: salaAprov, nome: "Interessado", telefone: "119",
      status: "novo", data_interesse: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaPub) await admin.from("clinica").delete().in("id", [clinicaPub, clinicaPriv]);
    for (const uid of [userProp, userRecep]) if (uid) await admin.auth.admin.deleteUser(uid);
  });

  it("RBAC: recepcionista NÃO cria sala; proprietário cria", async () => {
    const recep = await clientLogado(emailRecep, senha);
    const bloqueado = await recep.from("sala_vip").insert({ clinica_id: clinicaPub, nome: "X" });
    expect(bloqueado.error).not.toBeNull();

    const prop = await clientLogado(emailProp, senha);
    const ok = await prop.from("sala_vip").insert({ clinica_id: clinicaPub, nome: `Nova ${sufixo}` });
    expect(ok.error).toBeNull();
  });

  it("exposição pública: anon só vê sala aprovada+ativa de clínica pública", async () => {
    const anon = clientAnon();
    const { data } = await anon
      .from("sala_vip")
      .select("nome,status,ativa,clinica_id")
      .in("clinica_id", [clinicaPub, clinicaPriv]);
    const vistos = data ?? [];
    expect(vistos.every((s) => s.status === "aprovada" && s.ativa)).toBe(true);
    expect(vistos.every((s) => s.clinica_id === clinicaPub)).toBe(true);
    expect(vistos.some((s) => s.status === "pendente")).toBe(false);
  });

  it("anon NUNCA lê os interessados (lead_sala_vip)", async () => {
    const anon = clientAnon();
    const { data } = await anon.from("lead_sala_vip").select("id").eq("clinica_id", clinicaPub);
    expect((data ?? []).length).toBe(0);
  });

  it("isolamento: clínica não vê sala/lead de outra", async () => {
    const prop = await clientLogado(emailProp, senha);
    const { data: salas } = await prop.from("sala_vip").select("id").eq("clinica_id", clinicaPriv);
    expect((salas ?? []).length).toBe(0);
  });
});
