import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { gerarSlots } from "@/lib/slots";
import type { IntervaloDisponibilidade } from "@/lib/disponibilidade";

/**
 * S6 — Slots livres do agendamento público, TZ-aware. Roda no servidor com
 * service_role (o público não lê `consulta`). O cálculo (passo = duração,
 * horário da clínica ∩ janela do profissional − intervalos − ocupados, no fuso
 * da clínica) vive em @/lib/slots (puro/testado). `duracaoMin` = soma das
 * durações dos serviços selecionados (decisão: SOMA); default 30.
 */
const PROF_INI_PADRAO = 8 * 60; // 08:00
const PROF_FIM_PADRAO = 18 * 60; // 18:00

function horaParaMin(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

export async function slotsDisponiveis(
  clinicaId: string,
  profissionalId: string,
  duracaoMin = 30,
  diasAdiante = 14
): Promise<string[]> {
  const admin = createAdminClient();

  const [{ data: prof }, { data: clinica }] = await Promise.all([
    admin
      .from("profissional")
      .select("id,dias_atendimento,horario_inicio,horario_fim")
      .eq("id", profissionalId)
      .eq("clinica_id", clinicaId)
      .eq("ativo", true)
      .maybeSingle(),
    admin.from("clinica").select("timezone").eq("id", clinicaId).maybeSingle(),
  ]);
  if (!prof) return [];

  const [{ data: intervalos }, { data: horarios }] = await Promise.all([
    admin
      .from("profissional_intervalo")
      .select("tipo,dia_semana,hora_inicio,hora_fim,data_hora_inicio,data_hora_fim")
      .eq("clinica_id", clinicaId)
      .eq("profissional_id", profissionalId),
    admin
      .from("clinica_horario")
      .select("dia_semana,abertura,fechamento")
      .eq("clinica_id", clinicaId),
  ]);

  const agora = new Date();
  const fim = new Date(agora.getTime() + diasAdiante * 86_400_000);
  const { data: ocupadas } = await admin
    .from("consulta")
    .select("data_hora,duracao_minutos")
    .eq("clinica_id", clinicaId)
    .eq("profissional_id", profissionalId)
    .neq("status", "cancelado")
    .gte("data_hora", agora.toISOString())
    .lt("data_hora", fim.toISOString());

  const ocupados = (ocupadas ?? []).map((c) => {
    const inicio = new Date(c.data_hora);
    return { inicio, fim: new Date(inicio.getTime() + (c.duracao_minutos ?? 30) * 60_000) };
  });

  const diasAtend =
    prof.dias_atendimento && prof.dias_atendimento.length > 0
      ? prof.dias_atendimento
      : [1, 2, 3, 4, 5];

  return gerarSlots({
    agora,
    tz: clinica?.timezone ?? "America/Sao_Paulo",
    diasAdiante,
    duracaoMin,
    diasAtendimento: diasAtend,
    profIniMin: horaParaMin(prof.horario_inicio) ?? PROF_INI_PADRAO,
    profFimMin: horaParaMin(prof.horario_fim) ?? PROF_FIM_PADRAO,
    clinicaHorarios: horarios ?? [],
    intervalos: (intervalos ?? []) as IntervaloDisponibilidade[],
    ocupados,
  });
}

/**
 * Soma as durações dos serviços (SOMA) para definir o passo dos slots. Usa o
 * client admin (o público não lê `servico.duracao_minutos` fora do exibir_publico,
 * mas aqui é escopado à clínica e só devolve um número).
 */
export async function duracaoDosServicos(
  clinicaId: string,
  servicoIds: string[]
): Promise<number> {
  if (servicoIds.length === 0) return 30;
  const admin = createAdminClient();
  const { data } = await admin
    .from("servico")
    .select("duracao_minutos")
    .eq("clinica_id", clinicaId)
    .in("id", servicoIds);
  const soma = (data ?? []).reduce((acc, s) => acc + (s.duracao_minutos ?? 0), 0);
  return soma > 0 ? soma : 30;
}
