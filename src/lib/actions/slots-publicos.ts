"use server";

import { duracaoDosServicos, slotsDisponiveis } from "@/lib/agenda-publica";

/**
 * S6 — slots do agendamento público, recalculados quando o usuário troca de
 * profissional ou de serviços (passo = soma das durações). Devolve só ISO de
 * horários livres — nunca dados de `consulta`. Chamável pelo cliente (leitura
 * de disponibilidade pública).
 */
export async function carregarSlots(
  clinicaId: string,
  profissionalId: string,
  servicoIds: string[]
): Promise<string[]> {
  if (!clinicaId || !profissionalId) return [];
  const dur = await duracaoDosServicos(clinicaId, servicoIds);
  return slotsDisponiveis(clinicaId, profissionalId, dur);
}
