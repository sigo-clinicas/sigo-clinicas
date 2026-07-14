import { describe, expect, it } from "vitest";

import {
  autoMatch,
  parseExtratoCSV,
  valorAssinado,
  type MovSimples,
} from "@/lib/conciliacao";

describe("conciliação bancária (S3-4)", () => {
  it("parseExtratoCSV lê Data;Descrição;Valor e ignora cabeçalho", () => {
    const csv = [
      "Data;Descricao;Valor",
      "14/07/2026;PIX recebido;100,00",
      "15/07/2026;Pagamento aluguel;-1.200,50",
      "",
    ].join("\n");
    const linhas = parseExtratoCSV(csv);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toEqual({ data: "2026-07-14", descricao: "PIX recebido", valor: 100 });
    expect(linhas[1].valor).toBe(-1200.5);
    expect(linhas[1].data).toBe("2026-07-15");
  });

  it("valorAssinado: entrada (+), saída (−)", () => {
    expect(valorAssinado({ valor: 100, tipo: "entrada" })).toBe(100);
    expect(valorAssinado({ valor: 100, tipo: "saida" })).toBe(-100);
  });

  it("autoMatch casa por valor (±0,02) e data (±3 dias), sem reusar movimentação", () => {
    const movs: MovSimples[] = [
      { id: "m1", data: "2026-07-14", valor: 100, tipo: "entrada", conciliada: false },
      { id: "m2", data: "2026-07-15", valor: 1200.5, tipo: "saida", conciliada: false },
      { id: "m3", data: "2026-07-14", valor: 100, tipo: "entrada", conciliada: true }, // já conciliada
    ];
    const linhas = parseExtratoCSV(
      ["14/07/2026;PIX;100,01", "16/07/2026;Aluguel;-1200,50", "20/07/2026;Sem par;500,00"].join("\n")
    );
    const m = autoMatch(linhas, movs);
    expect(m.get(0)).toBe("m1"); // 100,01 ~ 100 (±0,02), mesma data
    expect(m.get(1)).toBe("m2"); // -1200,50, data +1 dia
    expect(m.has(2)).toBe(false); // 500 não tem par
  });

  it("autoMatch respeita a tolerância de dias", () => {
    const movs: MovSimples[] = [
      { id: "m1", data: "2026-07-01", valor: 50, tipo: "entrada", conciliada: false },
    ];
    const linhas = [{ data: "2026-07-10", descricao: "x", valor: 50 }];
    expect(autoMatch(linhas, movs).has(0)).toBe(false); // 9 dias > 3
    expect(autoMatch(linhas, movs, 30).get(0)).toBe("m1"); // com tolerância maior, casa
  });
});
