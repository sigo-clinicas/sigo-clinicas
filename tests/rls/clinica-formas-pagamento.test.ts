import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAnon, clientServiceRole, temAmbiente } from "./helpers";

/**
 * S2 — clinica.formas_pagamento (única coluna nova da fase). Dado de vitrine:
 * exibido na página pública da clínica.
 *
 * ARMADILHA guardada por este teste: por causa da allowlist do S0
 * (revoke select on clinica from anon + grant só das colunas públicas), uma
 * coluna nova nasce FECHADA ao anon. A migration PRECISA de um
 * `grant select (formas_pagamento) on clinica to anon` explícito — senão a
 * leitura pública dá 42501. O caso "anon lê de clínica pública" abaixo quebra
 * se esse grant faltar.
 */
describe.skipIf(!temAmbiente)("S2 — clinica.formas_pagamento no marketplace", () => {
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let admin: SupabaseClient;
  let clinicaPub: string, clinicaPriv: string;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data, error } = await admin
      .from("clinica")
      .insert([
        {
          nome: `FP Pub ${sufixo}`,
          slug: `fp-pub-${sufixo}`,
          tipo: "medica",
          ativo: true,
          exibir_marketplace: true,
          formas_pagamento: ["pix", "dinheiro", "cartao_credito"],
        },
        {
          nome: `FP Priv ${sufixo}`,
          slug: `fp-priv-${sufixo}`,
          tipo: "medica",
          ativo: true,
          exibir_marketplace: false,
          formas_pagamento: ["pix"],
        },
      ])
      .select("id");
    if (error) throw error;
    [clinicaPub, clinicaPriv] = data!.map((c) => c.id);
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaPub) await admin.from("clinica").delete().in("id", [clinicaPub, clinicaPriv]);
  });

  it("anon lê formas_pagamento de clínica pública (grant explícito não pode faltar)", async () => {
    const anon = clientAnon();
    const { data, error } = await anon
      .from("clinica")
      .select("formas_pagamento")
      .eq("id", clinicaPub)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.formas_pagamento).toEqual(["pix", "dinheiro", "cartao_credito"]);
  });

  it("anon NÃO vê formas_pagamento de clínica não-pública (RLS filtra a linha)", async () => {
    const anon = clientAnon();
    const { data, error } = await anon
      .from("clinica")
      .select("formas_pagamento")
      .eq("id", clinicaPriv);
    expect(error).toBeNull(); // RLS filtra sem erro (linha invisível), não é 42501
    expect(data ?? []).toEqual([]);
  });

  it("a coluna nova NÃO reabriu as colunas internas fechadas no S0", async () => {
    // guarda de regressão: adicionar uma coluna + grant pontual não pode ter
    // reaberto cnpj/config ao anon.
    const anon = clientAnon();
    const { error } = await anon.from("clinica").select("cnpj").eq("id", clinicaPub);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });
});
