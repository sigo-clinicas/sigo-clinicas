import { describe, expect, it } from "vitest";

import { instanteNaZona, partesNaZona } from "@/lib/fuso";

// Independente do TZ do processo (Intl com timeZone explícito). O CI roda em UTC;
// estes valores provam a correção que faltava (o cálculo antigo dava 3h de erro).
const SP = "America/Sao_Paulo";

describe("partesNaZona — instante UTC → parede local", () => {
  it("12:00Z em São Paulo é 09:00 local (UTC-3), segunda-feira", () => {
    const p = partesNaZona(new Date("2026-07-20T12:00:00Z"), SP); // 2026-07-20 é segunda
    expect(p.hora).toBe(9);
    expect(p.minuto).toBe(0);
    expect(p.diaSemana).toBe(1); // segunda
    expect(p.dia).toBe(20);
  });

  it("00:00Z vira 21:00 do dia ANTERIOR em São Paulo", () => {
    const p = partesNaZona(new Date("2026-07-20T00:00:00Z"), SP);
    expect(p.hora).toBe(21);
    expect(p.dia).toBe(19); // dia anterior
    expect(p.diaSemana).toBe(0); // domingo
  });
});

describe("instanteNaZona — parede local → instante UTC", () => {
  it("09:00 local em São Paulo é 12:00Z", () => {
    expect(instanteNaZona(2026, 7, 20, 9, 0, SP).toISOString()).toBe("2026-07-20T12:00:00.000Z");
  });

  it("round-trip: parede → UTC → parede preserva o horário local", () => {
    const utc = instanteNaZona(2026, 7, 20, 14, 30, SP);
    const p = partesNaZona(utc, SP);
    expect(p.hora).toBe(14);
    expect(p.minuto).toBe(30);
    expect(p.dia).toBe(20);
  });

  it("meia-noite local não escorrega de dia", () => {
    const utc = instanteNaZona(2026, 7, 20, 0, 0, SP);
    const p = partesNaZona(utc, SP);
    expect(p.dia).toBe(20);
    expect(p.hora).toBe(0);
  });
});
