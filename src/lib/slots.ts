// S6 — geração de slots livres (lógica pura, testável, TZ-aware).
//
// Corrige os defeitos confirmados na auditoria:
//  - passo = DURAÇÃO do serviço (era grade fixa de 60min);
//  - respeita o horário de funcionamento da clínica (S5) ∩ janela do profissional;
//  - fuso: horários de parede na zona da clínica (era TZ do processo → 3h off);
//  - ocupados por SOBREPOSIÇÃO real [ini,fim) (era igualdade exata de ISO).

import { instanteNaZona, partesNaZona } from "@/lib/fuso";
import type { IntervaloDisponibilidade } from "@/lib/disponibilidade";

function horaParaMin(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

export type HorarioClinica = { dia_semana: number; abertura: string; fechamento: string };
export type Ocupado = { inicio: Date; fim: Date };

export type ParamsSlots = {
  agora: Date;
  tz: string;
  diasAdiante: number;
  duracaoMin: number;
  diasAtendimento: number[]; // janela do profissional (fallback aplicado pelo caller)
  profIniMin: number;
  profFimMin: number;
  clinicaHorarios: HorarioClinica[]; // vazio = clínica não gateia (usa só o prof)
  intervalos: IntervaloDisponibilidade[];
  ocupados: Ocupado[];
};

function emIntervalo(
  intervalos: IntervaloDisponibilidade[],
  inicio: Date,
  fim: Date,
  dow: number,
  mIni: number,
  mFim: number
): boolean {
  for (const iv of intervalos) {
    if (iv.tipo === "fixo") {
      if (iv.dia_semana !== dow) continue;
      const i = horaParaMin(iv.hora_inicio);
      const f = horaParaMin(iv.hora_fim);
      if (i === null || f === null) continue;
      if (mIni < f && mFim > i) return true; // sobreposição em minutos locais
    } else {
      if (!iv.data_hora_inicio || !iv.data_hora_fim) continue;
      const bi = new Date(iv.data_hora_inicio);
      const bf = new Date(iv.data_hora_fim);
      if (inicio < bf && fim > bi) return true; // sobreposição de instantes
    }
  }
  return false;
}

export function gerarSlots(p: ParamsSlots): string[] {
  const dur = p.duracaoMin > 0 ? p.duracaoMin : 30;
  const clinicaGateia = p.clinicaHorarios.length > 0;
  const horarioPorDia = new Map<number, { ini: number; fim: number }>();
  for (const h of p.clinicaHorarios) {
    horarioPorDia.set(h.dia_semana, {
      ini: horaParaMin(h.abertura) ?? 0,
      fim: horaParaMin(h.fechamento) ?? 1440,
    });
  }

  const hoje = partesNaZona(p.agora, p.tz); // data de parede local de "agora"
  const slots: string[] = [];

  for (let d = 0; d < p.diasAdiante; d++) {
    // data local do dia d (Date.UTC só p/ aritmética de calendário — sem fuso aqui)
    const base = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + d));
    const ano = base.getUTCFullYear();
    const mes = base.getUTCMonth() + 1;
    const dia = base.getUTCDate();
    const dow = base.getUTCDay(); // 0=domingo

    if (!p.diasAtendimento.includes(dow)) continue;

    let winIni = p.profIniMin;
    let winFim = p.profFimMin;
    if (clinicaGateia) {
      const ch = horarioPorDia.get(dow);
      if (!ch) continue; // clínica fechada nesse dia
      winIni = Math.max(winIni, ch.ini);
      winFim = Math.min(winFim, ch.fim);
    }

    for (let m = winIni; m + dur <= winFim; m += dur) {
      const inicio = instanteNaZona(ano, mes, dia, Math.floor(m / 60), m % 60, p.tz);
      if (inicio < p.agora) continue;
      const fim = new Date(inicio.getTime() + dur * 60_000);
      if (emIntervalo(p.intervalos, inicio, fim, dow, m, m + dur)) continue;
      if (p.ocupados.some((o) => inicio < o.fim && fim > o.inicio)) continue;
      slots.push(inicio.toISOString());
    }
  }
  return slots;
}
