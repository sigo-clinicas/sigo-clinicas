import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAnon, clientLogado, clientServiceRole, criarUsuario, temAmbiente } from "./helpers";

/**
 * S1 — Cruzamento serviço ↔ profissional no marketplace público.
 *
 * A página da clínica precisa cruzar profissional_servico nos dois sentidos
 * (escolher serviço → profissionais que o fazem; escolher profissional →
 * serviços dele). Isso exige uma policy anon nova em profissional_servico.
 *
 * DUAS ARMADILHAS que este teste guarda:
 *  1. profissional_servico carrega tipo_comissao/valor_comissao. RLS é
 *     row-level → não fecha coluna. E `revoke select (col)` seria NO-OP porque
 *     o anon tem SELECT de tabela (ver S0). Só allowlist fecha a comissão.
 *  2. As 16 policies de marketplace da casa são `to anon, authenticated`, e
 *     PERMISSIVE faz OR entre roles → isso vazaria comissão cross-tenant para
 *     todo staff logado. Por isso a policy nova é `to anon` APENAS. A asserção
 *     de regressão (staff de outra clínica pública não lê estes vínculos) é o
 *     que prova essa escolha — e é invisível ao teste de isolamento atual, que
 *     usa exibir_marketplace: false e nunca dispara o gate de marketplace.
 */
describe.skipIf(!temAmbiente)("S1 — cruzamento serviço↔profissional (marketplace)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailPropPub2 = `prop-pub2-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaPub: string, clinicaPub2: string, clinicaPriv: string;
  let profA: string, profInativo: string, profB: string;
  let servicoPub: string, servicoInterno: string, servicoPubB: string;
  let userPropPub2: string;

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinicas, error: errC } = await admin
      .from("clinica")
      .insert([
        { nome: `Pub ${sufixo}`, slug: `pub-${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: true },
        { nome: `Pub2 ${sufixo}`, slug: `pub2-${sufixo}`, tipo: "estetica", ativo: true, exibir_marketplace: true },
        { nome: `Priv ${sufixo}`, slug: `priv-${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: false },
      ])
      .select("id");
    if (errC) throw errC;
    [clinicaPub, clinicaPub2, clinicaPriv] = clinicas!.map((c) => c.id);

    const { data: profs, error: errP } = await admin
      .from("profissional")
      .insert([
        { clinica_id: clinicaPub, nome: `Dr. A ${sufixo}`, ativo: true },
        { clinica_id: clinicaPub, nome: `Dr. Inativo ${sufixo}`, ativo: false },
        { clinica_id: clinicaPub2, nome: `Dr. B ${sufixo}`, ativo: true },
      ])
      .select("id");
    if (errP) throw errP;
    [profA, profInativo, profB] = profs!.map((p) => p.id);

    const { data: servs, error: errS } = await admin
      .from("servico")
      .insert([
        { clinica_id: clinicaPub, nome: `Serviço Público ${sufixo}`, ativo: true, exibir_publico: true },
        { clinica_id: clinicaPub, nome: `Serviço Interno ${sufixo}`, ativo: true, exibir_publico: false },
        { clinica_id: clinicaPub2, nome: `Serviço Pub2 ${sufixo}`, ativo: true, exibir_publico: true },
      ])
      .select("id");
    if (errS) throw errS;
    [servicoPub, servicoInterno, servicoPubB] = servs!.map((s) => s.id);

    // Vínculos, todos com comissão preenchida (o que NÃO pode vazar ao anon):
    const { error: errV } = await admin.from("profissional_servico").insert([
      // v1 — VÁLIDO: prof ativo + serviço público em clínica pública → visível ao anon
      { clinica_id: clinicaPub, profissional_id: profA, servico_id: servicoPub, tipo_comissao: "percentual", valor_comissao: 50 },
      // v2 — serviço NÃO público → escondido pelo gate
      { clinica_id: clinicaPub, profissional_id: profA, servico_id: servicoInterno, tipo_comissao: "percentual", valor_comissao: 40 },
      // v3 — profissional INATIVO → escondido pelo gate
      { clinica_id: clinicaPub, profissional_id: profInativo, servico_id: servicoPub, tipo_comissao: "percentual", valor_comissao: 30 },
      // v4 — outra clínica pública → não pode aparecer ao consultar clinicaPub
      { clinica_id: clinicaPub2, profissional_id: profB, servico_id: servicoPubB, tipo_comissao: "valor_fixo", valor_comissao: 99 },
    ]);
    if (errV) throw errV;

    userPropPub2 = await criarUsuario(admin, emailPropPub2, senha);
    const { error: errBind } = await admin
      .from("clinica_usuario")
      .insert({ clinica_id: clinicaPub2, user_id: userPropPub2, papel: "proprietario" });
    if (errBind) throw errBind;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaPub) await admin.from("clinica").delete().in("id", [clinicaPub, clinicaPub2, clinicaPriv]);
    if (userPropPub2) await admin.auth.admin.deleteUser(userPropPub2);
  });

  // -------- Anon: comportamento do cruzamento --------

  it("anon vê o vínculo válido (guarda anti-tautologia)", async () => {
    const anon = clientAnon();
    const { data, error } = await anon
      .from("profissional_servico")
      .select("servico_id,profissional_id")
      .eq("clinica_id", clinicaPub);
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].profissional_id).toBe(profA);
    expect(data![0].servico_id).toBe(servicoPub);
  });

  it("sentido serviço→profissional: o serviço lista os profissionais que o fazem", async () => {
    const anon = clientAnon();
    const { data } = await anon
      .from("profissional_servico")
      .select("profissional_id")
      .eq("clinica_id", clinicaPub)
      .eq("servico_id", servicoPub);
    expect((data ?? []).map((r) => r.profissional_id)).toEqual([profA]);

    // serviço não público não cruza com ninguém
    const { data: interno } = await anon
      .from("profissional_servico")
      .select("profissional_id")
      .eq("clinica_id", clinicaPub)
      .eq("servico_id", servicoInterno);
    expect(interno ?? []).toEqual([]);
  });

  it("sentido profissional→serviço: o profissional lista os serviços dele (só os públicos)", async () => {
    const anon = clientAnon();
    const { data } = await anon
      .from("profissional_servico")
      .select("servico_id")
      .eq("clinica_id", clinicaPub)
      .eq("profissional_id", profA);
    // profA tem vínculo com servicoPub E servicoInterno; só o público aparece
    expect((data ?? []).map((r) => r.servico_id)).toEqual([servicoPub]);

    // profissional inativo não cruza com nada
    const { data: inativo } = await anon
      .from("profissional_servico")
      .select("servico_id")
      .eq("clinica_id", clinicaPub)
      .eq("profissional_id", profInativo);
    expect(inativo ?? []).toEqual([]);
  });

  it("não-vazamento: anon NÃO lê tipo_comissao nem valor_comissao (42501)", async () => {
    const anon = clientAnon();
    const { error: errValor } = await anon.from("profissional_servico").select("valor_comissao");
    expect(errValor).not.toBeNull();
    expect(errValor!.code).toBe("42501");

    const { error: errTipo } = await anon.from("profissional_servico").select("tipo_comissao");
    expect(errTipo).not.toBeNull();
    expect(errTipo!.code).toBe("42501");
  });

  it("isolamento: clínica privada não expõe vínculos ao anon", async () => {
    const anon = clientAnon();
    const { data } = await anon
      .from("profissional_servico")
      .select("servico_id")
      .eq("clinica_id", clinicaPriv);
    expect(data ?? []).toEqual([]);
  });

  it("isolamento: consultar uma clínica pública não traz vínculos de outra", async () => {
    const anon = clientAnon();
    const { data: doPub } = await anon
      .from("profissional_servico")
      .select("clinica_id")
      .in("clinica_id", [clinicaPub, clinicaPub2])
      .eq("clinica_id", clinicaPub);
    expect((doPub ?? []).every((r) => r.clinica_id === clinicaPub)).toBe(true);

    // e o vínculo de pub2 é visível quando consultado por pub2 (não é isolamento por RLS de clínica pública, é escopo de query)
    const { data: doPub2 } = await anon
      .from("profissional_servico")
      .select("profissional_id")
      .eq("clinica_id", clinicaPub2);
    expect((doPub2 ?? []).map((r) => r.profissional_id)).toEqual([profB]);
  });

  // -------- Authenticated: regressão cross-tenant (prova do `to anon`) --------

  it("regressão: staff de outra clínica pública NÃO lê os vínculos desta", async () => {
    const supPub2 = await clientLogado(emailPropPub2, senha);
    const { data, error } = await supPub2
      .from("profissional_servico")
      .select("clinica_id,valor_comissao")
      .in("clinica_id", [clinicaPub, clinicaPub2]);
    expect(error).toBeNull();
    // Se a policy fosse `to anon, authenticated`, veria também clinicaPub (pública).
    // Com `to anon` apenas, só enxerga a própria clínica via a policy _membro.
    expect(data!.length).toBeGreaterThan(0); // guarda anti-tautologia
    expect(data!.every((r) => r.clinica_id === clinicaPub2)).toBe(true);
  });

  it("regressão: staff continua lendo a própria comissão (painel intocado)", async () => {
    const supPub2 = await clientLogado(emailPropPub2, senha);
    const { data, error } = await supPub2
      .from("profissional_servico")
      .select("valor_comissao")
      .eq("clinica_id", clinicaPub2);
    expect(error).toBeNull();
    expect(Number(data![0].valor_comissao)).toBe(99);
  });
});
