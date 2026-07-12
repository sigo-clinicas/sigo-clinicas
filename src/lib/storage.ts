"use server";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Gera signed URL para um objeto de bucket PRIVADO (prontuario/documentos),
 * no servidor, com o client da sessão (a storage policy por clinica_id
 * decide). O path precisa começar com o clinica_id da sessão — assim um
 * usuário não gera URL de objeto de outra clínica. Substitui as URLs
 * públicas do Base44 (A8).
 */
export async function urlAssinada(
  bucket: "prontuario" | "documentos",
  path: string
): Promise<string | null> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return null;
  // Defesa extra: o path tem de ser do tenant ativo
  if (!path.startsWith(`${sessao.clinicaAtual}/`)) return null;

  const supabase = createClient();
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 10); // 10 min
  return data?.signedUrl ?? null;
}
