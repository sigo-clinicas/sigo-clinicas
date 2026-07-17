import { describe, expect, it } from "vitest";

import { gerarSlots, type ParamsSlots } from "@/lib/slots";
import { partesNaZona } from "@/lib/fuso";

const SP = "America/Sao_Paulo";

// "agora" fixo bem no passado do dia-base para não depender de Date.now().
// 2026-07-20 é uma SEGUNDA. Ancoramos "agora" às 00:00 local desse dia.
const AGORA = new Date("2026-07-20T03:00:00Z"); // 00:00 local em SP (UTC-3)

const base: ParamsSlots = {
  agora: AGORA,
  tz: SP,
  diasAdiante: 1, // só o dia-base (segunda)
  duracaoMin: 60,
  diasAtendimento: [1], // segunda
  profIniMin: 9 * 60, // 09:00
  profFimMin: 12 * 60, // 12:00
  clinicaHorarios: [],
  intervalos: [],
  ocupados: [],
};

describe("gerarSlots — passo = duração e fuso da clínica", () => {
  it("passo = duração: 60min entre 09:00 e 12:00 → 09:00, 10:00, 11:00 (local)", () => {
    const s = gerarSlots(base);
    const locais = s.map((iso) => {
      const p = partesNaZona(new Date(iso), SP);
      return `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
    });
    expect(locais).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("os slots são instantes UTC corretos (09:00 SP = 12:00Z)", () => {
    const s = gerarSlots(base);
    expect(s[0]).toBe("2026-07-20T12:00:00.000Z");
  });

  it("duração de 30min dobra a granularidade", () => {
    const s = gerarSlots({ ...base, duracaoMin: 30 });
    expect(s.length).toBe(6); // 09:00,09:30,10:00,10:30,11:00,11:30
  });

  it("um serviço de 90min não gera slot que ultrapasse a janela (12:00)", () => {
    const s = gerarSlots({ ...base, duracaoMin: 90 });
    // 09:00(→10:30), 10:00(→11:30); 11:00→12:30 estoura → fora
    expect(s.length).toBe(2);
  });
});

describe("gerarSlots — horário de funcionamento da clínica (S5)", () => {
  it("intersecta a janela do profissional com o horário da clínica", () => {
    const s = gerarSlots({
      ...base,
      profIniMin: 8 * 60,
      profFimMin: 18 * 60,
      clinicaHorarios: [{ dia_semana: 1, abertura: "10:00", fechamento: "12:00" }],
    });
    const horas = s.map((iso) => partesNaZona(new Date(iso), SP).hora);
    expect(horas).toEqual([10, 11]); // limitado pela clínica 10-12
  });

  it("dia sem horário da clínica (fechado) não gera slots quando a clínica gateia", () => {
    const s = gerarSlots({
      ...base,
      clinicaHorarios: [{ dia_semana: 3, abertura: "09:00", fechamento: "18:00" }], // só quarta
    });
    expect(s).toEqual([]); // segunda não tem horário → fechado
  });

  it("clínica sem nenhum horário não gateia (usa só o profissional)", () => {
    const s = gerarSlots({ ...base, clinicaHorarios: [] });
    expect(s.length).toBe(3);
  });
});

describe("gerarSlots — ocupados por sobreposição real e intervalos", () => {
  it("remove slot que sobrepõe um ocupado (não por igualdade exata)", () => {
    // ocupado 10:30–11:00 (local) → colide com o slot 10:00–11:00
    const ocupInicio = new Date("2026-07-20T13:30:00Z"); // 10:30 local
    const s = gerarSlots({
      ...base,
      ocupados: [{ inicio: ocupInicio, fim: new Date(ocupInicio.getTime() + 30 * 60_000) }],
    });
    const horas = s.map((iso) => partesNaZona(new Date(iso), SP).hora);
    expect(horas).toEqual([9, 11]); // 10:00 removido por sobreposição parcial
  });

  it("intervalo fixo (almoço) remove o slot correspondente", () => {
    const s = gerarSlots({
      ...base,
      duracaoMin: 30,
      profFimMin: 13 * 60,
      intervalos: [
        { tipo: "fixo", dia_semana: 1, hora_inicio: "12:00", hora_fim: "13:00", data_hora_inicio: null, data_hora_fim: null },
      ],
    });
    const horas = s.map((iso) => {
      const p = partesNaZona(new Date(iso), SP);
      return `${p.hora}:${String(p.minuto).padStart(2, "0")}`;
    });
    expect(horas).not.toContain("12:0"); // 12:00/12:30 bloqueados pelo almoço
    expect(horas).toContain("11:30");
  });

  it("não gera slots no passado", () => {
    const s = gerarSlots({ ...base, agora: new Date("2026-07-20T13:00:00Z") }); // 10:00 local
    const horas = s.map((iso) => partesNaZona(new Date(iso), SP).hora);
    expect(horas).toEqual([10, 11]); // 09:00 já passou
  });
});
