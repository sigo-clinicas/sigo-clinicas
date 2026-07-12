import { describe, expect, it } from "vitest";

// Smoke test para o job de testes unitários do CI nunca rodar vazio.
// Substituído por testes reais (cálculos financeiros etc.) a partir do S1/S3.
describe("smoke", () => {
  it("ambiente de teste funciona", () => {
    expect(1 + 1).toBe(2);
  });
});
