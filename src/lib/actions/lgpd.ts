"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limparStoragePaciente } from "@/lib/lgpd-storage";

/**
 * S2-5 — Ações LGPD.
 * anonimizarPaciente: privilegiada (admin de plataforma). A RPC faz o scrub de
 * PII, a trilha de accountability e encerra o usuário (transacional); a limpeza
 * de Storage roda depois, pela Storage API com service_role (o Supabase proíbe
 * DELETE direto em storage.objects). abrirSolicitacaoLgpd: o titular logado abre
 * o pedido (art. 18) — a execução é do admin.
 */

export type EstadoLgpd = { erro: string | null; ok?: boolean; objetosRemovidos?: number };

export async function anonimizarPaciente(input: {
  pacienteId: string;
  motivo: string;
}): Promise<EstadoLgpd> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.isAdmin) return { erro: "Apenas o admin de plataforma pode anonimizar." };
  if (!input.motivo.trim()) return { erro: "Informe o motivo/base legal." };

  // RPC valida is_admin() de novo (defesa em profundidade) e devolve as clínicas
  // vinculadas para a limpeza de Storage.
  const supabase = createClient();
  const { data: clinicas, error } = await supabase.rpc("anonimizar_paciente", {
    p_paciente_id: input.pacienteId,
    p_motivo: input.motivo.trim(),
  });
  if (error) {
    return {
      erro: error.code === "42501" ? "Sem permissão." : "Falha ao anonimizar o paciente.",
    };
  }

  // Limpeza de Storage cross-tenant com service_role (fora da RPC).
  let objetosRemovidos = 0;
  try {
    const adminDb = createAdminClient();
    objetosRemovidos = await limparStoragePaciente(
      adminDb,
      input.pacienteId,
      (clinicas as string[]) ?? []
    );
  } catch {
    // O scrub já ocorreu; a falha de storage é registrada mas não reverte a
    // anonimização (o registro clínico não expõe PII). Reexecutável.
    return { erro: null, ok: true, objetosRemovidos: -1 };
  }

  revalidatePath("/admin/lgpd");
  return { erro: null, ok: true, objetosRemovidos };
}

export async function abrirSolicitacaoLgpd(input: {
  tipo: "exportacao" | "exclusao";
  detalhe: string;
}): Promise<EstadoLgpd> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.pacienteId) return { erro: "Apenas o próprio paciente pode abrir o pedido." };

  const supabase = createClient();
  const { error } = await supabase.rpc("abrir_solicitacao_lgpd", {
    p_tipo: input.tipo,
    p_detalhe: input.detalhe || "",
  });
  if (error) return { erro: "Não foi possível registrar o pedido." };
  return { erro: null, ok: true };
}
