// S6 — conversão de fuso SEM dependência externa (via Intl). O servidor roda em
// UTC (Vercel gru1), mas os slots e a janela do profissional são horário de
// PAREDE (local) da clínica. O cálculo anterior usava getHours/getDay no TZ do
// processo → 3h de erro em produção, invisível em dev. Estas funções são
// independentes do TZ do processo (Intl com timeZone explícito).

export type PartesLocais = {
  ano: number;
  mes: number; // 1-12
  dia: number;
  hora: number; // 0-23
  minuto: number;
  diaSemana: number; // 0=domingo (getDay)
};

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const DOW: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Componentes de parede (local) de um instante numa zona. */
export function partesNaZona(instante: Date, tz: string): PartesLocais {
  const p = fmt(tz).formatToParts(instante);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return {
    ano: Number(g("year")),
    mes: Number(g("month")),
    dia: Number(g("day")),
    hora: Number(g("hour")),
    minuto: Number(g("minute")),
    diaSemana: DOW[g("weekday")],
  };
}

/**
 * Instante UTC de um horário de parede (local) numa zona. Técnica do offset:
 * para zonas sem DST (Brasil desde 2019) é exato; no caso geral, resolve exceto
 * na hora exata de transição de DST (fora do escopo do marketplace BR).
 */
export function instanteNaZona(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  tz: string
): Date {
  const chuteUTC = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const p = partesNaZona(new Date(chuteUTC), tz);
  const comoLocal = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
  const offset = comoLocal - chuteUTC; // wall-clock local à frente do chute
  return new Date(chuteUTC - offset);
}

/** Minutos desde a meia-noite (local), a partir das partes. */
export function minutosLocais(p: PartesLocais): number {
  return p.hora * 60 + p.minuto;
}
