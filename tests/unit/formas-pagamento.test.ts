import { describe, expect, it } from "vitest";

import { rotulosFormasPagamento } from "@/lib/formas-pagamento";

describe("rotulosFormasPagamento", () => {
  it("mapeia para rótulos legíveis", () => {
    expect(rotulosFormasPagamento(["pix", "dinheiro"])).toEqual(["Dinheiro", "Pix"]);
  });

  it("respeita a ordem canônica do enum, não a de entrada", () => {
    // entrada fora de ordem → saída na ordem do enum (dinheiro antes de pix)
    expect(rotulosFormasPagamento(["pix", "cartao_credito", "dinheiro"])).toEqual([
      "Dinheiro",
      "Cartão de crédito",
      "Pix",
    ]);
  });

  it("descarta valores desconhecidos sem quebrar", () => {
    expect(rotulosFormasPagamento(["pix", "bitcoin"])).toEqual(["Pix"]);
  });

  it("vazio/nulo → lista vazia", () => {
    expect(rotulosFormasPagamento(null)).toEqual([]);
    expect(rotulosFormasPagamento([])).toEqual([]);
    expect(rotulosFormasPagamento(undefined)).toEqual([]);
  });
});
