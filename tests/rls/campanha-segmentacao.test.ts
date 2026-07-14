import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S4-3 — Segmentação de campanha. Teste-CHAVE: a contagem de público-alvo é
 * ISOLADA por clínica (não vaza pacientes entre clínicas), o filtro funciona, e
 * paciente compartilhado (N:N) conta só no vínculo certo. + RBAC (recepção não
 * cria campanha).
 */
describe.skipIf(!temAmbiente)("Campanha: segmentação isolada (S4-3)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailProp = `cmp-prop-${sufixo}@teste.sigo`;
  const emailRecep = `cmp-recep-${sufixo}@teste.sigo`;
  const emailPropB = `cmp-propb-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaA: string, clinicaB: string;
  let userProp: string, userRecep: string, userPropB: string;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Cmp A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Cmp B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    [clinicaA, clinicaB] = clinicas!.map((c) => c.id);

    userProp = await criarUsuario(admin, emailProp, senha);
    userRecep = await criarUsuario(admin, emailRecep, senha);
    userPropB = await criarUsuario(admin, emailPropB, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userProp, papel: "proprietario" },
      { clinica_id: clinicaA, user_id: userRecep, papel: "recepcionista" },
      { clinica_id: clinicaB, user_id: userPropB, papel: "proprietario" },
    ]);

    // pacA1 (masc), pacA2 (fem) só em A; pacB1 só em B; pacShared (masc) em A e B
    const { data: pacs } = await admin
      .from("paciente")
      .insert([
        { nome: `PA1 ${sufixo}`, sexo: "masculino", cidade: "SP", ativo: true },
        { nome: `PA2 ${sufixo}`, sexo: "feminino", cidade: "RJ", ativo: true },
        { nome: `PB1 ${sufixo}`, sexo: "masculino", cidade: "SP", ativo: true },
        { nome: `PSH ${sufixo}`, sexo: "masculino", cidade: "SP", ativo: true },
      ])
      .select("id,nome");
    const id = (p: string) => pacs!.find((x) => x.nome.startsWith(p))!.id;
    await admin.from("paciente_clinica").insert([
      { clinica_id: clinicaA, paciente_id: id("PA1"), ativo: true },
      { clinica_id: clinicaA, paciente_id: id("PA2"), ativo: true },
      { clinica_id: clinicaB, paciente_id: id("PB1"), ativo: true },
      { clinica_id: clinicaA, paciente_id: id("PSH"), ativo: true },
      { clinica_id: clinicaB, paciente_id: id("PSH"), ativo: true },
    ]);
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaA) await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    await admin.from("paciente").delete().ilike("nome", `%${sufixo}%`);
    for (const uid of [userProp, userRecep, userPropB]) if (uid) await admin.auth.admin.deleteUser(uid);
  });

  it("conta o público da PRÓPRIA clínica (compartilhado conta uma vez)", async () => {
    const sup = await clientLogado(emailProp, senha);
    const { data } = await sup.rpc("campanha_publico_alvo", { p_clinica_id: clinicaA, p_filtros: {} });
    expect(Number(data)).toBe(3); // PA1, PA2, PSH — não PB1
  });

  it("ISOLAMENTO: gestor de A não conta o público de B (→ 0)", async () => {
    const sup = await clientLogado(emailProp, senha);
    const { data } = await sup.rpc("campanha_publico_alvo", { p_clinica_id: clinicaB, p_filtros: {} });
    expect(Number(data)).toBe(0); // não é membro de B → RLS filtra
  });

  it("filtro por gênero funciona (masculino=2, feminino=1)", async () => {
    const sup = await clientLogado(emailProp, senha);
    const masc = await sup.rpc("campanha_publico_alvo", {
      p_clinica_id: clinicaA, p_filtros: { demograficos: { generos: ["masculino"] } },
    });
    expect(Number(masc.data)).toBe(2); // PA1 + PSH
    const fem = await sup.rpc("campanha_publico_alvo", {
      p_clinica_id: clinicaA, p_filtros: { demograficos: { generos: ["feminino"] } },
    });
    expect(Number(fem.data)).toBe(1); // PA2
  });

  it("filtro por cidade funciona", async () => {
    const sup = await clientLogado(emailProp, senha);
    const { data } = await sup.rpc("campanha_publico_alvo", {
      p_clinica_id: clinicaA, p_filtros: { demograficos: { localizacoes: ["RJ"] } },
    });
    expect(Number(data)).toBe(1); // só PA2
  });

  it("RBAC: recepcionista NÃO cria campanha", async () => {
    const recep = await clientLogado(emailRecep, senha);
    const { error } = await recep
      .from("campanha")
      .insert({ clinica_id: clinicaA, nome: `X ${sufixo}`, filtros: {}, conteudo: {} });
    expect(error).not.toBeNull();
  });
});
