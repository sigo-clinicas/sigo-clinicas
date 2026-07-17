import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAnon, clientServiceRole, temAmbiente } from "./helpers";

/**
 * S0 (hotfix de segurança) — colunas internas fechadas ao anon.
 *
 * `clinica_select_marketplace` expõe a LINHA da clínica pública ao anon — é o que
 * faz o marketplace funcionar, e está correto. Mas RLS é ROW-level: sem revoke de
 * coluna, `GET /rest/v1/clinica?select=cnpj` devolve o CNPJ de toda clínica pública
 * para quem tiver a chave publishable (que está no browser de todo visitante).
 * Selecionar coluna a coluna no nosso código não mitiga nada: o vetor é o PostgREST
 * direto, não a nossa query.
 *
 * SEMÂNTICA DE QUE ESTE TESTE DEPENDE: linha bloqueada por RLS FILTRA (sem erro);
 * coluna sem privilégio ERRA com 42501. Por isso as asserções são sobre `error`,
 * não sobre `data` vazio — um `.select()` que devolvesse [] passaria despercebido.
 */
describe.skipIf(!temAmbiente)("S0 — colunas internas não vazam para o anon", () => {
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let admin: SupabaseClient;
  let clinicaPublica: string;

  const COLUNAS_INTERNAS_CLINICA = [
    "razao_social",
    "cnpj",
    "config",
    "retencao_prontuario_meses",
    "retencao_fiscal_meses",
    "retencao_marketing_meses",
    "is_seed_demo",
  ] as const;

  const COLUNAS_INTERNAS_PROFISSIONAL = [
    "cpf",
    "data_nascimento",
    "email",
    "telefone",
    "user_id",
  ] as const;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinica, error } = await admin
      .from("clinica")
      .insert({
        nome: `S0 Pública ${sufixo}`,
        slug: `s0-publica-${sufixo}`,
        tipo: "medica",
        ativo: true,
        exibir_marketplace: true,
        // dados internos que NÃO podem sair pela porta do marketplace
        razao_social: `Razão Social S0 ${sufixo} LTDA`,
        cnpj: "12345678000199",
        telefone: "1133334444",
        email: `contato-${sufixo}@clinica.teste`,
      })
      .select("id")
      .single();
    if (error) throw error;
    clinicaPublica = clinica.id;

    const { error: errProf } = await admin.from("profissional").insert({
      clinica_id: clinicaPublica,
      nome: `Dra. S0 ${sufixo}`,
      nome_conselho: "CRM",
      numero_registro: "123456",
      cpf: "11122233344",
      data_nascimento: "1980-05-10",
      email: `dra-${sufixo}@clinica.teste`,
      telefone: "11999998888",
      ativo: true,
    });
    if (errProf) throw errProf;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaPublica) await admin.from("clinica").delete().eq("id", clinicaPublica);
  });

  // Guarda anti-tautologia: se a linha não estivesse visível ao anon, os testes de
  // 42501 abaixo poderiam passar pelo motivo errado.
  it("anon LÊ as colunas públicas da clínica (a linha é visível por design)", async () => {
    const anon = clientAnon();
    const { data, error } = await anon
      .from("clinica")
      .select("nome,slug")
      .eq("id", clinicaPublica)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.slug).toBe(`s0-publica-${sufixo}`);
  });

  it.each(COLUNAS_INTERNAS_CLINICA)("anon NÃO lê clinica.%s (42501)", async (coluna) => {
    const anon = clientAnon();
    const { error } = await anon.from("clinica").select(coluna).eq("id", clinicaPublica);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it.each(COLUNAS_INTERNAS_PROFISSIONAL)("anon NÃO lê profissional.%s (42501)", async (coluna) => {
    const anon = clientAnon();
    const { error } = await anon
      .from("profissional")
      .select(coluna)
      .eq("clinica_id", clinicaPublica);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  // Regressões: o funil público depende destas leituras. Se o revoke for largo
  // demais, a página da clínica quebra — e o teste acima ainda passaria.
  it("anon continua lendo clinica.telefone,email (usado por clinicaPorSlug)", async () => {
    const anon = clientAnon();
    const { data, error } = await anon
      .from("clinica")
      .select("telefone,email")
      .eq("id", clinicaPublica)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.telefone).toBe("1133334444");
  });

  it("anon continua lendo as colunas públicas do profissional", async () => {
    const anon = clientAnon();
    const { data, error } = await anon
      .from("profissional")
      .select("id,nome,nome_conselho,numero_registro")
      .eq("clinica_id", clinicaPublica);
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].nome_conselho).toBe("CRM");
  });

  it("a view do marketplace continua funcionando (grant preservado)", async () => {
    const anon = clientAnon();
    const { data, error } = await anon
      .from("marketplace_clinica")
      .select("id,nome,slug")
      .eq("id", clinicaPublica)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(clinicaPublica);
  });
});
