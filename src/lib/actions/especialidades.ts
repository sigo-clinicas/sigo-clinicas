"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * S1-4 — Especialidades dinâmicas (decisão da call de 02/07):
 * segmento → especialidade são cadastros GLOBAIS geridos pelo admin da
 * plataforma (RLS *_admin_all); a clínica seleciona as suas em
 * clinica_especialidade (RLS proprietário/gerente).
 */

export type EstadoEspecialidades = { erro: string | null; ok?: boolean };

export async function criarSegmento(
  _estado: EstadoEspecialidades,
  formData: FormData
): Promise<EstadoEspecialidades> {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome do segmento." };

  const supabase = createClient();
  const { error } = await supabase.from("segmento").insert({ nome });
  if (error) return { erro: "Sem permissão ou segmento já existe." };

  revalidatePath("/admin/especialidades");
  return { erro: null, ok: true };
}

export async function criarEspecialidade(
  _estado: EstadoEspecialidades,
  formData: FormData
): Promise<EstadoEspecialidades> {
  const nome = String(formData.get("nome") ?? "").trim();
  const segmentoId = String(formData.get("segmento_id") ?? "");
  if (!nome || !segmentoId) return { erro: "Informe segmento e nome." };

  const supabase = createClient();
  const { error } = await supabase
    .from("especialidade")
    .insert({ nome, segmento_id: segmentoId });
  if (error) return { erro: "Sem permissão ou especialidade já existe." };

  revalidatePath("/admin/especialidades");
  return { erro: null, ok: true };
}

export async function alternarAtivoEspecialidade(
  id: string,
  ativo: boolean
): Promise<EstadoEspecialidades> {
  const supabase = createClient();
  const { error } = await supabase
    .from("especialidade")
    .update({ ativo })
    .eq("id", id);
  if (error) return { erro: "Sem permissão." };

  revalidatePath("/admin/especialidades");
  return { erro: null, ok: true };
}

/** Substitui o conjunto de especialidades da clínica atual (multisseleção). */
export async function salvarEspecialidadesClinica(
  especialidadeIds: string[]
): Promise<EstadoEspecialidades> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };
  if (!["proprietario", "gerente"].includes(sessao.papel ?? "") && !sessao.isAdmin) {
    return { erro: "Sem permissão para alterar as especialidades." };
  }

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const { data: atuais, error: erroLeitura } = await supabase
    .from("clinica_especialidade")
    .select("id,especialidade_id")
    .eq("clinica_id", clinicaId);
  if (erroLeitura) return { erro: "Não foi possível carregar a seleção atual." };

  const desejadas = new Set(especialidadeIds);
  const existentes = new Set((atuais ?? []).map((a) => a.especialidade_id));

  const remover = (atuais ?? [])
    .filter((a) => !desejadas.has(a.especialidade_id))
    .map((a) => a.id);
  const adicionar = especialidadeIds
    .filter((id) => !existentes.has(id))
    .map((especialidade_id) => ({ clinica_id: clinicaId, especialidade_id }));

  if (remover.length > 0) {
    const { error } = await supabase
      .from("clinica_especialidade")
      .delete()
      .in("id", remover);
    if (error) return { erro: "Sem permissão para remover especialidades." };
  }
  if (adicionar.length > 0) {
    const { error } = await supabase
      .from("clinica_especialidade")
      .insert(adicionar);
    if (error) return { erro: "Sem permissão para adicionar especialidades." };
  }

  revalidatePath("/painel/configuracoes");
  return { erro: null, ok: true };
}
