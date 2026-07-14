import { describe, expect, it } from "vitest";

import {
  conciliarGuias,
  itensParaBaixa,
  parseCsvGuias,
  parseValorBR,
  type AtendimentoConvenio,
} from "@/lib/convenio-csv";

describe("parseValorBR", () => {
  it("normaliza formato BR e internacional", () => {
    expect(parseValorBR("1.234,56")).toBe(1234.56);
    expect(parseValorBR("R$ 1.234,56")).toBe(1234.56);
    expect(parseValorBR("120,00")).toBe(120);
    expect(parseValorBR("120.00")).toBe(120);
    expect(parseValorBR("0")).toBe(0);
    expect(parseValorBR("")).toBe(0);
    expect(parseValorBR("abc")).toBe(0);
  });
});

describe("parseCsvGuias", () => {
  it("lê cabeçalho + delimitador ;", () => {
    const csv = "numero_guia;valor_pago\nG1;120,00\nG2;0\n";
    expect(parseCsvGuias(csv)).toEqual([
      { numero_guia: "G1", valor_pago: 120 },
      { numero_guia: "G2", valor_pago: 0 },
    ]);
  });

  it("assume col0=guia,col1=valor sem cabeçalho e delimitador ,", () => {
    const csv = "G1,80.00\nG3,45.50";
    expect(parseCsvGuias(csv)).toEqual([
      { numero_guia: "G1", valor_pago: 80 },
      { numero_guia: "G3", valor_pago: 45.5 },
    ]);
  });

  it("ignora linhas vazias e sem guia", () => {
    const csv = "guia;valor\n;99\nG9;10,00\n\n";
    expect(parseCsvGuias(csv)).toEqual([{ numero_guia: "G9", valor_pago: 10 }]);
  });
});

describe("conciliarGuias + itensParaBaixa", () => {
  const atend: AtendimentoConvenio[] = [
    { lancamento_id: "L1", numero_guia: "G1", valor_devido: 120 },
    { lancamento_id: "L2", numero_guia: "G2", valor_devido: 200 },
    { lancamento_id: "L3", numero_guia: "G3", valor_devido: 50 },
    { lancamento_id: "L4", numero_guia: "G4", valor_devido: 90 }, // sem retorno
  ];

  it("classifica paga/divergente/glosada/não-reconhecida/sem-retorno", () => {
    const linhas = [
      { numero_guia: "G1", valor_pago: 120 }, // paga
      { numero_guia: "G2", valor_pago: 150 }, // divergente (glosa parcial)
      { numero_guia: "G3", valor_pago: 0 }, // glosada
      { numero_guia: "G9", valor_pago: 77 }, // não reconhecida
    ];
    const r = conciliarGuias(atend, linhas);
    const por = Object.fromEntries(r.map((g) => [g.numero_guia, g.situacao]));
    expect(por).toEqual({
      G1: "paga",
      G2: "divergente",
      G3: "glosada",
      G9: "nao_reconhecida",
      G4: "sem_retorno",
    });
  });

  it("itensParaBaixa só inclui pagas/divergentes com valor (clampa ao devido)", () => {
    const linhas = [
      { numero_guia: "G1", valor_pago: 120 }, // paga → 120
      { numero_guia: "G2", valor_pago: 150 }, // divergente → 150
      { numero_guia: "G3", valor_pago: 0 }, // glosada → fora
      { numero_guia: "G9", valor_pago: 77 }, // não reconhecida → fora
    ];
    const itens = itensParaBaixa(conciliarGuias(atend, linhas));
    expect(itens).toEqual([
      { lancamento_id: "L1", valor: 120 },
      { lancamento_id: "L2", valor: 150 },
    ]);
  });

  it("clampa pagamento a maior ao valor devido (sem crédito fantasma)", () => {
    const itens = itensParaBaixa(
      conciliarGuias(atend, [{ numero_guia: "G1", valor_pago: 999 }])
    );
    expect(itens).toEqual([{ lancamento_id: "L1", valor: 120 }]);
  });
});
