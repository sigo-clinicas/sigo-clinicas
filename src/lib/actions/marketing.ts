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
