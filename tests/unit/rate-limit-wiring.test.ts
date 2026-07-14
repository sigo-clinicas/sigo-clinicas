import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S4-6 (validação de fechamento) — checagem ESTÁTICA de que os 3 endpoints
 * públicos REALMENTE fiam o rate-limit e devolvem 429. Um teste de flood por
 * HTTP não cabe aqui: as chamadas de teste compartilham o mesmo IP → o mesmo
 * bucket `anamnese:<ip>`, e estourar o limite quebraria as ~15 asserções
 * legítimas de `anamnese-token.test.ts`. Esta checagem de fonte é a regressão
 * proporcional: guarda contra alguém remover a chamada do limiter.
 */
const dir = path.dirname(fileURLToPath(import.meta.url));
const ler = (rel: string) => readFileSync(path.resolve(dir, "../..", rel), "utf8");

describe("Rate-limit fiado nos endpoints públicos (S4-6)", () => {
  it("agendamento: consome o rate-limit ANTES de agendar e devolve 429", () => {
    const f = ler("src/app/api/publico/agendamento/route.ts");
    expect(f).toMatch(/consumirRateLimit\s*\(/);
    expect(f).toMatch(/status:\s*429/);
    // o gate (call-site) vem antes de chamar a RPC de agendamento
    expect(f.indexOf("consumirRateLimit(")).toBeLessThan(f.indexOf('"agendar_publico"'));
  });

  it("lead: consome o rate-limit e devolve 429", () => {
    const f = ler("src/app/api/publico/lead/route.ts");
    expect(f).toMatch(/consumirRateLimit\s*\(/);
    expect(f).toMatch(/status:\s*429/);
    // o gate (call-site) vem antes de resolver a clínica / inserir o lead
    expect(f.indexOf("consumirRateLimit(")).toBeLessThan(f.indexOf("resolverClinicaLead("));
  });

  it("anamnese (Edge): chama consumir_rate_limit e responde 429/rate_limited", () => {
    const f = ler("supabase/functions/anamnese-publica/index.ts");
    expect(f).toMatch(/rpc\(\s*["']consumir_rate_limit["']/);
    expect(f).toMatch(/rate_limited/);
    expect(f).toMatch(/\b429\b/);
  });
});
