import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  profissionalDisponivel,
  type IntervaloDisponibilidade,
  type JanelaProfissional,
} from "@/lib/disponibilidade";

/**
 * S3-8 — Slots livres de um profissional para o agendamento público. Roda no
 * servidor com service_role (o público não lê `consulta`); devolve só ISO de
 * horários livres. Reusa profissionalDisponivel (janela − intervalos) e remove
 * os horários já ocupados. NOTA: janela em horário do servidor (refinamento de
 * fuso sinalizado); consistente entre exibição e agendamento (mesmo ISO).
 */
export async function slotsDisponiveis(
  clinicaId: string,
  profissionalId: string,
  diasAdiante = 14,
  duracaoMin = 30
): Promise<string[]> {
  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("profissional")
    .select("id,dias_atendimento,horario_inicio,horario_fim")
    .eq("id", profissionalId)
    .eq("clinica_id", clinicaId)
    .eq("ativo", true)
    .maybeSingle();
  if (!prof) return [];

  const { data: intervalos } = await admin
    .from("profissional_intervalo")
    .select("tipo,dia_semana,hora_inicio,hora_fim,data_hora_inicio,data_hora_fim")
    .eq("clinica_id", clinicaId)
    .eq("profissional_id", profissionalId);

  const agora = new Date();
  const fim = new Date(agora.getTime() + diasAdiante * 86_400_000);
  const { data: ocupadas } = await admin
    .from("consulta")
    .select("data_hora")
    .eq("clinica_id", clinicaId)
    .eq("profissional_id", profissionalId)
    .neq("status", "cancelado")
    .gte("data_hora", agora.toISOString())
    .lt("data_hora", fim.toISOString());

  const ocupadasSet = new Set(
    (ocupadas ?? []).map((c) => new Date(c.data_hora).toISOString())
  );

  const janela: JanelaProfissional = {
    dias_atendimento: prof.dias_atendimento ?? [1, 2, 3, 4, 5],
    horario_inicio: prof.horario_inicio,
    horario_fim: prof.horario_fim,
    intervalos: (intervalos ?? []) as IntervaloDisponibilidade[],
  };

  const slots: string[] = [];
  for (let d = 0; d < diasAdiante; d++) {
    const dia = new Date(agora);
    dia.setDate(agora.getDate() + d);
    for (let h = 7; h <= 18; h++) {
      const inicio = new Date(dia);
      inicio.setHours(h, 0, 0, 0);
      if (inicio < agora) continue;
      if (!profissionalDisponivel(janela, inicio, duracaoMin)) continue;
      const iso = inicio.toISOString();
      if (ocupadasSet.has(iso)) continue;
      slots.push(iso);
    }
  }
  return slots;
}
