import { describe, expect, it } from "vitest";

import {
  DEFAULT_DASHBOARD,
  formatarKpi,
  KPIS,
  kpisConfigurados,
  taxaComparecimento,
  ticketMedio,
  type ResumoDashboard,
} from "@/lib/relatorios/kpis";

const resumo: ResumoDashboard = {
  faturamento_recebido: 1000,
  despesas_pagas: 400,
  a_receber: 200,
  a_pagar: 50,
  consultas_total: 12,
  consultas_concluidas: 8,
  consultas_faltou: 2,
  consultas_retorno: 3,
  pacientes_unicos: 7,
  por_profissional: [],
  servicos_mais_vendidos: [],
};

describe("KPIs configuráveis (S4-4)", () => {
  it("fórmulas puras", () => {
    expect(taxaComparecimento(8, 2)).toBe(80);
    expect(taxaComparecimento(0, 0)).toBe(0);
    expect(ticketMedio(1000, 8)).toBe(125);
    expect(ticketMedio(1000, 0)).toBe(0);
  });

  it("cada KPI deriva do resumo corretamente", () => {
    expect(KPIS.faturamento_recebido.valor(resumo)).toBe(1000);
    expect(KPIS.lucro.valor(resumo)).toBe(600); // 1000 - 400
    expect(KPIS.taxa_comparecimento.valor(resumo)).toBe(80);
    expect(KPIS.ticket_medio.valor(resumo)).toBe(125);
    expect(KPIS.retorno.valor(resumo)).toBe(3);
  });

  it("kpisConfigurados respeita a ordem e cai no default se inválido", () => {
    expect(kpisConfigurados(["retorno", "lucro"])).toEqual(["retorno", "lucro"]);
    expect(kpisConfigurados(["inexistente", 42])).toEqual(DEFAULT_DASHBOARD);
    expect(kpisConfigurados(null)).toEqual(DEFAULT_DASHBOARD);
  });

  it("formatação por tipo", () => {
    expect(formatarKpi(80, "percent")).toBe("80%");
    expect(formatarKpi(7, "numero")).toBe("7");
    expect(formatarKpi(1000, "moeda")).toContain("1.000");
  });
});
