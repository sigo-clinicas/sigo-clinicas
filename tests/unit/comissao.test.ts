import { describe, expect, it } from "vitest";

import { calcularComissao, intervaloCompetencia } from "@/lib/comissao";

describe("cálculo de comissão (S3-5)", () => {
  it("percentual: aplica a taxa sobre a base", () => {
    expect(calcularComissao("percentual", 10, 200)).toBe(20);
    expect(calcularComissao("percentual", 15, 100)).toBe(15);
    expect(calcularComissao("percentual", 10, 0)).toBe(0); // base 0 → 0
  });

  it("valor_fixo: paga o valor independente da base", () => {
    expect(calcularComissao("valor_fixo", 50, 999)).toBe(50);
    expect(calcularComissao("valor_fixo", 50, 0)).toBe(50);
  });

  it("arredonda a 2 casas", () => {
    expect(calcularComissao("percentual", 33.33, 100)).toBe(33.33);
    expect(calcularComissao("percentual", 7.5, 33.33)).toBe(2.5);
  });

  it("intervaloCompetencia devolve o mês correto", () => {
    const r = intervaloCompetencia("2026-07");
    expect(r.primeiroDia).toBe("2026-07-01");
    expect(r.ultimoDia).toBe("2026-07-31");
    expect(r.fim.slice(0, 10)).toBe("2026-08-01");
  });
});
