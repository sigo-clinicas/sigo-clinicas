"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * S1-6 — Serviço unificado (A4: Servico×Procedimento fundidos; preço SEMPRE
 * via tabela de preço) + tabelas de preço + convênios. Escrita: proprietário/
 * gerente (RLS padrão dos cadastros).
 */

export type EstadoServicos = { erro: string | null; ok?: boolean };

export type ServicoInput = {
  id?: string;
  nome: string;
  codigo?: string | null;
  duracao_minutos: number;
  especialidade_id?: string | null;
  exibir_publico: boolean;
  observacoes?: string | null;
  ativo: boolean;
};

export async function salvarServico(
  input: ServicoInput
): Promise<EstadoServicos> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };
  if (!input.nome.trim()) return { erro: "Informe o nome do serviço." };

  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual,
    nome: input.nome.trim(),
    codigo: input.codigo || null,
    duracao_minutos: Number(input.duracao_minutos) || 30,
    especialidade_id: input.especialidade_id || null,
    exibir_publico: input.exibir_publico,
    observacoes: input.observacoes || null,
    ativo: input.ativo,
  };

  const { error } = input.id
    ? await supabase
        .from("servico")
        .update(dados)
        .eq("id", input.id)
        .eq("clinica_id", sessao.clinicaAtual)
    : await supabase.from("servico").insert(dados);

  if (error) {
    return {
      erro:
        error.code === "23505"
          ? "Já existe um serviço com este nome."
          : "Sem permissão para salvar o serviço.",
    };
  }

  revalidatePath("/painel/servicos");
  return { erro: null, ok: true };
}

export async function excluirServico(id: string): Promise<EstadoServicos> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };

  const supabase = createClient();
  const { error } = await supabase
    .from("servico")
    .delete()
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual);
  if (error) return { erro: "Sem permissão para excluir." };

  revalidatePath("/painel/servicos");
  return { erro: null, ok: true };
}

export type ItemTabelaInput = {
  servico_id: string;
  tipo_valor: "fixo" | "a_partir_de" | "gratuito";
  valor: number | null;
};

export type TabelaPrecoInput = {
  id?: string;
  nome: string;
  convenio_id?: string | null;
  descricao?: string | null;
  exibir_publico: boolean;
  ativo: boolean;
  itens: ItemTabelaInput[];
};

export async function salvarTabelaPreco(
  input: TabelaPrecoInput
): Promise<EstadoServicos> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };
  if (!input.nome.trim()) return { erro: "Informe o nome da tabela." };

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const dadosTabela = {
    clinica_id: clinicaId,
    nome: input.nome.trim(),
    convenio_id: input.convenio_id || null,
    descricao: input.descricao || null,
    exibir_publico: input.exibir_publico,
    ativo: input.ativo,
  };

  let tabelaId = input.id;
  if (tabelaId) {
    const { error } = await supabase
      .from("tabela_preco")
      .update(dadosTabela)
      .eq("id", tabelaId)
      .eq("clinica_id", clinicaId);
    if (error) return { erro: "Sem permissão para salvar a tabela." };
  } else {
    const { data, error } = await supabase
      .from("tabela_preco")
      .insert(dadosTabela)
      .select("id")
      .single();
    if (error) return { erro: "Sem permissão para criar a tabela." };
    tabelaId = data.id;
  }

  // Substituição do conjunto de itens (RLS valida)
  await supabase
    .from("item_tabela_preco")
    .delete()
    .eq("tabela_preco_id", tabelaId);

  const validos = input.itens.filter((i) => i.servico_id);
  if (validos.length > 0) {
    const { error } = await supabase.from("item_tabela_preco").insert(
      validos.map((i) => ({
        clinica_id: clinicaId,
        tabela_preco_id: tabelaId!,
        servico_id: i.servico_id,
        tipo_valor: i.tipo_valor,
        valor: i.tipo_valor === "gratuito" ? null : Number(i.valor) || 0,
      }))
    );
    if (error) return { erro: "Tabela salva, mas houve erro nos itens." };
  }

  revalidatePath("/painel/servicos");
  return { erro: null, ok: true };
}

export async function excluirTabelaPreco(id: string): Promise<EstadoServicos> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };

  const supabase = createClient();
  const { error } = await supabase
    .from("tabela_preco")
    .delete()
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual);
  if (error) return { erro: "Sem permissão para excluir." };

  revalidatePath("/painel/servicos");
  return { erro: null, ok: true };
}

export type ConvenioInput = {
  id?: string;
  nome: string;
  codigo?: string | null;
  tipo: "plano_saude" | "particular" | "sus" | "outros";
  contato?: string | null;
  prazo_pagamento_dias?: number | null;
  observacoes?: string | null;
  ativo: boolean;
};

export async function salvarConvenio(
  input: ConvenioInput
): Promise<EstadoServicos> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };
  if (!input.nome.trim()) return { erro: "Informe o nome do convênio." };

  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual,
    nome: input.nome.trim(),
    codigo: input.codigo || null,
    tipo: input.tipo,
    contato: input.contato || null,
    prazo_pagamento_dias: input.prazo_pagamento_dias ?? null,
    observacoes: input.observacoes || null,
    ativo: input.ativo,
  };

  const { error } = input.id
    ? await supabase
        .from("convenio")
        .update(dados)
        .eq("id", input.id)
        .eq("clinica_id", sessao.clinicaAtual)
    : await supabase.from("convenio").insert(dados);

  if (error) return { erro: "Sem permissão para salvar o convênio." };

  revalidatePath("/painel/financeiro/convenios");
  return { erro: null, ok: true };
}

export async function excluirConvenio(id: string): Promise<EstadoServicos> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };

  const supabase = createClient();
  const { error } = await supabase
    .from("convenio")
    .delete()
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual);
  if (error) return { erro: "Sem permissão para excluir." };

  revalidatePath("/painel/financeiro/convenios");
  return { erro: null, ok: true };
}
