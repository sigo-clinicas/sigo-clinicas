import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * S3-8/S3-9 — Resolve o clinica_id de um lead SEMPRE no servidor (regressão do
 * achado de segurança): origem `cupom` deriva do cupom; origem `marketplace`
 * só aceita clínica existente e PÚBLICA (ativa+exibir_marketplace), senão null
 * (lead global). Nunca grava um clinica_id arbitrário vindo do cliente.
 */
export async function resolverClinicaLead(
  supabase: SupabaseClient,
  input: { origem: string; clinica_id?: string | null; cupom_id?: string | null }
): Promise<string | null> {
  if (input.origem === "cupom" && input.cupom_id) {
    const { data } = await supabase
      .from("cupom")
      .select("clinica_id")
      .eq("id", input.cupom_id)
      .maybeSingle();
    return (data?.clinica_id as string | undefined) ?? null;
  }
  if (input.clinica_id) {
    const { data } = await supabase
      .from("clinica")
      .select("id")
      .eq("id", input.clinica_id)
      .eq("ativo", true)
      .eq("exibir_marketplace", true)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  }
  return null;
}
