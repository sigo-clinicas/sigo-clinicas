// Cálculo de disponibilidade do profissional (S1-8). Módulo puro, usável no
// servidor (validação de conflito na action) e no cliente (grade da agenda).
// Regra do legado: janela de trabalho (dias + horário) MENOS os intervalos
// (profissional_has_intervalo): fixo = recorrente por dia da semana;
// pontual = janela de datas.

export type IntervaloDisponibilidade = {
  tipo: "fixo" | "pontual";
  dia_semana: number | null;
  hora_inicio: string | null; // "HH:MM[:SS]"
  hora_fim: string | null;
  data_hora_inicio: string | null; // ISO
  data_hora_fim: string | null;
};

export type JanelaProfissional = {
  dias_atendimento: number[];
  horario_inicio: string | null;
  horario_fim: string | null;
  intervalos: IntervaloDisponibilidade[];
};

function minutosDoDia(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function horaParaMinutos(hora: string | null): number | null {
  if (!hora) return null;
  const [h, m] = hora.split(":");
  return Number(h) * 60 + Number(m);
}

/** O profissional está DISPONÍVEL neste instante (dentro da janela e fora
 *  dos intervalos)? `duracaoMin` estende o fim do slot. */
export function profissionalDisponivel(
  janela: JanelaProfissional,
  inicio: Date,
  duracaoMin = 0
): boolean {
  const dia = inicio.getDay();
  const dias =
    janela.dias_atendimento.length > 0
      ? janela.dias_atendimento
      : [1, 2, 3, 4, 5];
  if (!dias.includes(dia)) return false;

  const ini = horaParaMinutos(janela.horario_inicio) ?? 7 * 60;
  const fim = horaParaMinutos(janela.horario_fim) ?? 19 * 60;
  const slotIni = minutosDoDia(inicio);
  const slotFim = slotIni + duracaoMin;
  if (slotIni < ini || slotFim > fim) return false;

  const fimInstante = new Date(inicio.getTime() + duracaoMin * 60000);
  for (const iv of janela.intervalos) {
    if (iv.tipo === "fixo") {
      if (iv.dia_semana !== dia) continue;
      const ivI = horaParaMinutos(iv.hora_inicio);
      const ivF = horaParaMinutos(iv.hora_fim);
      if (ivI === null || ivF === null) continue;
      // sobreposição de intervalos [slotIni,slotFim) x [ivI,ivF)
      if (slotIni < ivF && slotFim > ivI) return false;
    } else {
      if (!iv.data_hora_inicio || !iv.data_hora_fim) continue;
      const bi = new Date(iv.data_hora_inicio);
      const bf = new Date(iv.data_hora_fim);
      if (inicio < bf && fimInstante > bi) return false;
    }
  }
  return true;
}
