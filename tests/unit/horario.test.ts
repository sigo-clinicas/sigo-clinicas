import { describe, expect, it } from "vitest";

import { formatarHorarios, horaCurta } from "@/lib/horario";

describe("horaCurta", () => {
  it("corta segundos", () => {
    expect(horaCurta("09:00:00")).toBe("09:00");
    expect(horaCurta("18:30")).toBe("18:30");
  });
});

describe("formatarHorarios", () => {
  it("ordena segunda→domingo (domingo por último) e formata", () => {
    const r = formatarHorarios([
      { dia_semana: 0, abertura: "10:00:00", fechamento: "14:00:00" }, // domingo
      { dia_semana: 1, abertura: "09:00:00", fechamento: "18:00:00" }, // segunda
      { dia_semana: 6, abertura: "09:00:00", fechamento: "13:00:00" }, // sábado
    ]);
    expect(r).toEqual([
      { dia: "Segunda-feira", intervalo: "09:00 – 18:00" },
      { dia: "Sábado", intervalo: "09:00 – 13:00" },
      { dia: "Domingo", intervalo: "10:00 – 14:00" },
    ]);
  });

  it("dias ausentes não aparecem (= fechado)", () => {
    const r = formatarHorarios([{ dia_semana: 3, abertura: "08:00", fechamento: "12:00" }]);
    expect(r).toEqual([{ dia: "Quarta-feira", intervalo: "08:00 – 12:00" }]);
  });

  it("lista vazia → vazio", () => {
    expect(formatarHorarios([])).toEqual([]);
  });
});
