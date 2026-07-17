import { describe, expect, it } from "vitest";

import { rotuloPreco, type ItemPreco } from "@/lib/preco";

const item = (
  tipo_valor: ItemPreco["tipo_valor"],
  valor: number | null,
  tabela_nome: string | null = "Particular"
): ItemPreco => ({ tipo_valor, valor, tabela_nome });

describe("rotuloPreco — tabela de decisão (corrige os 2 defeitos do legado)", () => {
  it("ramo 1 — sem nenhuma tabela pública → 'Valor sob consulta'", () => {
    expect(rotuloPreco([])).toBe("Valor sob consulta");
  });

  it("ramo 2 — fixo → só o valor (sem rótulo, paridade com o antigo)", () => {
    expect(rotuloPreco([item("fixo", 150)])).toBe("R$ 150,00");
  });

  it("ramo 3 — a_partir_de → 'A partir de R$...'", () => {
    expect(rotuloPreco([item("a_partir_de", 150)])).toBe("A partir de R$ 150,00");
  });

  it("ramo 4 — gratuito EXIBE 'Gratuito' (defeito do legado: era dead code)", () => {
    // no legado, gratuito (valor 0/null) caía em 'Valor sob consulta'. Aqui não.
    expect(rotuloPreco([item("gratuito", null)])).toBe("Gratuito");
    expect(rotuloPreco([item("gratuito", 0)])).toBe("Gratuito");
  });

  it("ramo 5 — valor ausente em não-gratuito (defensivo) → 'Valor sob consulta'", () => {
    // o CHECK do banco impede isso, mas a função não pode quebrar se ocorrer
    expect(rotuloPreco([item("fixo", null)])).toBe("Valor sob consulta");
  });

  describe("determinismo com 2+ tabelas (defeito do legado: tabelaSite[0] sem ORDER BY)", () => {
    it("escolhe o MENOR valor, não a ordem de chegada", () => {
      const itens = [item("fixo", 300, "Convênio"), item("a_partir_de", 120, "Particular")];
      // menor custo (120) vence → 'A partir de'
      expect(rotuloPreco(itens)).toBe("A partir de R$ 120,00");
      // ordem de entrada invertida → mesmo resultado (determinístico)
      expect(rotuloPreco([...itens].reverse())).toBe("A partir de R$ 120,00");
    });

    it("gratuito (custo 0) vence qualquer pago e exibe 'Gratuito'", () => {
      const itens = [item("fixo", 200, "Particular"), item("gratuito", null, "SUS")];
      expect(rotuloPreco(itens)).toBe("Gratuito");
    });

    it("empate de valor: desempata pelo nome da tabela (determinístico)", () => {
      const a = [item("fixo", 100, "Zebra"), item("a_partir_de", 100, "Alfa")];
      // mesmo valor → 'Alfa' vence por nome → 'A partir de'
      expect(rotuloPreco(a)).toBe("A partir de R$ 100,00");
      expect(rotuloPreco([...a].reverse())).toBe("A partir de R$ 100,00");
    });
  });
});
