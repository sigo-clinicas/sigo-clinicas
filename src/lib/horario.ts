// S5 — formatação do horário de funcionamento (lógica pura, testável).
// dia_semana na convenção getDay() (0=domingo..6=sábado), coerente com o cálculo
// de slots do S6.

export type HorarioDia = {
  dia_semana: number;
  abertura: string; // "HH:MM[:SS]"
  fechamento: string;
};

export const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

/** "09:00:00" | "09:00" → "09:00". Robusto a segundos e a lixo. */
export function horaCurta(t: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(t);
  return m ? `${m[1]}:${m[2]}` : t;
}

export type LinhaHorario = { dia: string; intervalo: string };

/**
 * Ordena por dia (segunda→domingo, ordem de leitura brasileira) e formata cada
 * dia com horário. Dias ausentes não aparecem (= fechado). Determinístico.
 */
export function formatarHorarios(horarios: HorarioDia[]): LinhaHorario[] {
  // ordem de exibição: seg(1)..sáb(6), dom(0) por último
  const ordem = (d: number) => (d === 0 ? 7 : d);
  return [...horarios]
    .sort((a, b) => ordem(a.dia_semana) - ordem(b.dia_semana))
    .filter((h) => h.dia_semana >= 0 && h.dia_semana <= 6)
    .map((h) => ({
      dia: DIAS_SEMANA[h.dia_semana],
      intervalo: `${horaCurta(h.abertura)} – ${horaCurta(h.fechamento)}`,
    }));
}
