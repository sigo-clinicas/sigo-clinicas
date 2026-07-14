"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * S3-6 — Marketing: cupons (CRUD do painel, proprietário/gerente) + destaque/
 * ranqueamento (config admin — modelo de cobrança parametrizável). O cupom já
 * existe no schema; aqui só a operação. clinica_destaque é escrito só por admin.
 */

export type EstadoMkt = { erro: string | null; ok?: boolean };

type TipoDesconto = "percentual" | "valor";
type StatusCupom = "pendente" | "ativo" | "aceito" | "expirado" | "cancelado";

export type CupomInput = {
  id?: string;
  codigo: string;
  tipo_desconto: TipoDesconto;
  valor_desconto: number;
  descricao?: string | null;
  status: StatusCupom;
  validade_inicio?: string | null;
  validade_fim?: string | null;
  regras_uso?: string | null;
  quantidade_usos: number;
};

async function exigirMarketing() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { sessao: null, erro: "Sessão inválida." } as const;
  if (!["proprietario", "gerente"].includes(sessao.papel ?? "") && !sessao.isAdmin) {
    return { sessao: null, erro: "Sem permissão para marketing." } as const;
  }
  return { sessao, erro: null } as const;
}

export async function salvarCupom(input: CupomInput): Promise<EstadoMkt> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  if (!input.codigo.trim()) return { erro: "Informe o código do cupom." };
  if (Number(input.valor_desconto) <= 0) return { erro: "Desconto deve ser maior que zero." };

  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual!,
    codigo: input.codigo.trim().toUpperCase(),
    tipo_desconto: input.tipo_desconto,
    valor_desconto: Number(input.valor_desconto),
    descricao: input.descricao || null,
    status: input.status,
    validade_inicio: input.validade_inicio || null,
    validade_fim: input.validade_fim || null,
    regras_uso: input.regras_uso || null,
    quantidade_usos: Number(input.quantidade_usos) || 1,
  };
  const { error } = input.id
    ? await supabase.from("cupom").update(dados).eq("id", input.id).eq("clinica_id", sessao.clinicaAtual!)
    : await supabase.from("cupom").insert(dados);
  if (error) {
    return { erro: error.code === "23505" ? "Já existe um cupom com esse código." : "Sem permissão para salvar o cupom." };
  }
  revalidatePath("/painel/marketing/cupons");
  return { erro: null, ok: true };
}

export async function excluirCupom(id: string): Promise<EstadoMkt> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase.from("cupom").delete().eq("id", id).eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Não foi possível excluir o cupom." };
  revalidatePath("/painel/marketing/cupons");
  return { erro: null, ok: true };
}

export type DestaqueInput = {
  clinica_id: string;
  nivel: "neutro" | "parceiro" | "premium";
  score_manual: number;
  ativo: boolean;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
};

/**
 * Config de destaque/ranqueamento — SÓ admin de plataforma (RLS reforça).
 * Ponto onde o modelo de cobrança pluga no futuro (hoje só nível + score).
 */
export async function salvarDestaque(input: DestaqueInput): Promise<EstadoMkt> {
  const sessao = await getSessaoComClaims();
  if (!sessao) return { erro: "Sessão inválida." };
  if (!sessao.isAdmin) return { erro: "Apenas admin de plataforma configura destaque." };

  const supabase = createClient();
  const { error } = await supabase.from("clinica_destaque").upsert(
    {
      clinica_id: input.clinica_id,
      nivel: input.nivel,
      score_manual: Number(input.score_manual) || 0,
      ativo: input.ativo,
      vigencia_inicio: input.vigencia_inicio || null,
      vigencia_fim: input.vigencia_fim || null,
    },
    { onConflict: "clinica_id" }
  );
  if (error) return { erro: "Sem permissão para configurar destaque." };
  return { erro: null, ok: true };
}

// ===========================================================================
// S4-2 — Depoimentos + Sala VIP (gestão do painel; proprietário/gerente).
// Schema/RLS já existentes (marketing_assinatura). Usar FKs (servico_id/
// profissional_id), não *_nome desnormalizado.
// ===========================================================================

type StatusDepoimento = "pendente" | "aprovado" | "recusado";

export type DepoimentoInput = {
  id?: string;
  paciente_nome: string;
  texto: string;
  nota?: number | null;
  profissional_id?: string | null;
  servico_id?: string | null;
  publicar_no_site?: boolean;
  destaque?: boolean;
};

export async function salvarDepoimento(input: DepoimentoInput): Promise<EstadoMkt> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  if (!input.paciente_nome.trim()) return { erro: "Informe o nome do paciente." };
  if (!input.texto.trim()) return { erro: "O depoimento não pode ficar vazio." };
  if (input.nota != null && (input.nota < 1 || input.nota > 5)) {
    return { erro: "Nota deve ser de 1 a 5." };
  }

  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual!,
    paciente_nome: input.paciente_nome.trim(),
    texto: input.texto.trim(),
    nota: input.nota ?? null,
    profissional_id: input.profissional_id || null,
    servico_id: input.servico_id || null,
    publicar_no_site: input.publicar_no_site ?? false,
    destaque: input.destaque ?? false,
  };
  const { error } = input.id
    ? await supabase.from("depoimento").update(dados).eq("id", input.id).eq("clinica_id", sessao.clinicaAtual!)
    : await supabase.from("depoimento").insert({ ...dados, origem: "manual" });
  if (error) return { erro: "Sem permissão para salvar o depoimento." };
  revalidatePath("/painel/marketing/depoimentos");
  return { erro: null, ok: true };
}

export async function moderarDepoimento(
  id: string,
  status: StatusDepoimento
): Promise<EstadoMkt> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  const supabase = createClient();
  const patch =
    status !== "aprovado"
      ? { status, publicar_no_site: false, destaque: false }
      : { status };
  const { error } = await supabase
    .from("depoimento").update(patch).eq("id", id).eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Sem permissão para moderar." };
  revalidatePath("/painel/marketing/depoimentos");
  return { erro: null, ok: true };
}

/** Publicar/destacar. destaque só faz sentido publicado; despublicar zera destaque. */
export async function atualizarExposicaoDepoimento(
  id: string,
  publicar: boolean,
  destaque: boolean
): Promise<EstadoMkt> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase
    .from("depoimento")
    .update({ publicar_no_site: publicar, destaque: publicar ? destaque : false })
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Sem permissão para publicar." };
  revalidatePath("/painel/marketing/depoimentos");
  return { erro: null, ok: true };
}

export async function excluirDepoimento(id: string): Promise<EstadoMkt> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase.from("depoimento").delete().eq("id", id).eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Não foi possível excluir." };
  revalidatePath("/painel/marketing/depoimentos");
  return { erro: null, ok: true };
}

/** Cria um depoimento pendente (origem 'solicitado') com token de link. */
export async function solicitarDepoimento(input: {
  paciente_nome: string;
  profissional_id?: string | null;
  servico_id?: string | null;
}): Promise<EstadoMkt & { token?: string }> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  if (!input.paciente_nome.trim()) return { erro: "Informe o nome do paciente." };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("depoimento")
    .insert({
      clinica_id: sessao.clinicaAtual!,
      paciente_nome: input.paciente_nome.trim(),
      texto: "",
      profissional_id: input.profissional_id || null,
      servico_id: input.servico_id || null,
      status: "pendente",
      origem: "solicitado",
    })
    .select("token_solicitacao")
    .single();
  if (error) return { erro: "Não foi possível gerar a solicitação." };
  revalidatePath("/painel/marketing/depoimentos");
  return { erro: null, ok: true, token: (data?.token_solicitacao as string) ?? undefined };
}

// ---- Sala VIP --------------------------------------------------------------

type StatusSalaVip = "pendente" | "aprovada" | "rejeitada";
type StatusLeadVip = "novo" | "contatado" | "aprovado" | "recusado";

export type SalaVipInput = {
  id?: string;
  nome: string;
  descricao?: string | null;
  beneficios?: string | null;
  quantidade_vagas: number;
};

export async function salvarSalaVip(input: SalaVipInput): Promise<EstadoMkt> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  if (!input.nome.trim()) return { erro: "Informe o nome da sala." };
  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual!,
    nome: input.nome.trim(),
    descricao: input.descricao || null,
    beneficios: input.beneficios || null,
    quantidade_vagas: Number(input.quantidade_vagas) || 100,
  };
  const { error } = input.id
    ? await supabase.from("sala_vip").update(dados).eq("id", input.id).eq("clinica_id", sessao.clinicaAtual!)
    : await supabase.from("sala_vip").insert(dados);
  if (error) return { erro: "Sem permissão para salvar a sala VIP." };
  revalidatePath("/painel/marketing/sala-vip");
  return { erro: null, ok: true };
}

export async function atualizarStatusSalaVip(
  id: string,
  status: StatusSalaVip
): Promise<EstadoMkt> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase
    .from("sala_vip")
    .update({ status, ativa: status === "aprovada" })
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Sem permissão." };
  revalidatePath("/painel/marketing/sala-vip");
  return { erro: null, ok: true };
}

export async function excluirSalaVip(id: string): Promise<EstadoMkt> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase.from("sala_vip").delete().eq("id", id).eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Não foi possível excluir (há interessados?)." };
  revalidatePath("/painel/marketing/sala-vip");
  return { erro: null, ok: true };
}

export async function atualizarStatusLeadVip(
  id: string,
  status: StatusLeadVip
): Promise<EstadoMkt> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase
    .from("lead_sala_vip").update({ status }).eq("id", id).eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Sem permissão." };
  revalidatePath("/painel/marketing/sala-vip");
  return { erro: null, ok: true };
}

export async function excluirLeadVip(id: string): Promise<EstadoMkt> {
  const { sessao, erro } = await exigirMarketing();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase.from("lead_sala_vip").delete().eq("id", id).eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Não foi possível excluir." };
  revalidatePath("/painel/marketing/sala-vip");
  return { erro: null, ok: true };
}
