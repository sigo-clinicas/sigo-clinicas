import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S2-4 (DoD): checagens ESTÁTICAS da Edge Function anamnese-publica que o teste
 * de integração não pega, mas que são requisito da slice:
 *  - nenhum select/update de resposta_anamnese SEM .eq("token", ...) (regressão
 *    de escopo é o furo mais grave numa função com service_role);
 *  - service_role só via Deno.env, nunca literal no código (lição do legado, que
 *    tinha chave no Dockerfile).
 */
const dir = path.dirname(fileURLToPath(import.meta.url));
const fonte = readFileSync(
  path.resolve(dir, "../../supabase/functions/anamnese-publica/index.ts"),
  "utf8"
);

describe("Edge anamnese-publica — checagens estáticas (S2-4)", () => {
  it("toda cadeia .from('resposta_anamnese') encadeia .eq('token'", () => {
    // Quebra o fonte em cadeias que começam em .from('resposta_anamnese') e vão
    // até o ; final; cada uma tem de conter .eq("token".
    const regex = /\.from\(\s*["']resposta_anamnese["']\s*\)([\s\S]*?);/g;
    const cadeias = [...fonte.matchAll(regex)];
    expect(cadeias.length).toBeGreaterThan(0);
    for (const c of cadeias) {
      expect(c[1]).toMatch(/\.eq\(\s*["']token["']/);
    }
  });

  it("service_role só via Deno.env.get, nunca literal", () => {
    expect(fonte).toMatch(/Deno\.env\.get\(\s*["']SUPABASE_SERVICE_ROLE_KEY["']\s*\)/);
    // nenhum JWT/chave hardcoded (serviço service_role tem 'role":"service_role')
    expect(fonte).not.toMatch(/service_role["'][^)]*ey[A-Za-z0-9]/);
    expect(fonte).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/); // nenhum JWT literal
  });

  it("valida token como UUID antes de qualquer uso", () => {
    expect(fonte).toMatch(/UUID_RE/);
    // a validação (return 400) vem antes do primeiro createClient
    const idxValida = fonte.indexOf("invalid_token");
    const idxClient = fonte.indexOf("createClient(");
    expect(idxValida).toBeGreaterThan(0);
    expect(idxValida).toBeLessThan(idxClient);
  });
});
