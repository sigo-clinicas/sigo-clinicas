"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import type { KpiId } from "@/lib/relatorios/kpis";

/**
 * S4-4 — Persiste a seleção/ordem de KPIs do dashboard em clinica.config.dashboard.
 * A escrita em `clinica` é do PROPRIETÁRIO (RLS clinica_update_proprietario) —
 * gerente visualiza o relatório mas quem personaliza o painel é o proprietário.
 */
export async function atualizarConfigDashboard(
  kpis: KpiId[]
): Promise<{ erro: string | null; ok?: boolean }> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };
  if (sessao.papel !== "proprietario" && !sessao.isAdmin) {
    return { erro: "Apenas o proprietário personaliza o painel." };
  }

  const supabase = createClient();
  const { data: atual } = await supabase
    .from("clinica").select("config").eq("id", sessao.clinicaAtual).single();
  const config = {
    ...((atual?.config as Record<string, Json> | null) ?? {}),
    dashboard: { kpis },
  } as Json;
  const { error } = await supabase
    .from("clinica").update({ config }).eq("id", sessao.clinicaAtual);
  if (error) return { erro: "Sem permissão para salvar o painel." };
  revalidatePath("/painel/relatorios");
  return { erro: null, ok: true };
}
