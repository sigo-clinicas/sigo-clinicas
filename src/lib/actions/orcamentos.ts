"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

/**
 * S3-1 — Funil comercial (orçamento). Porta de reference/base44
 * src/pages/Orcamentos.jsx (OrcamentoForm) + OrcamentoKanban.jsx.
 * Escrita: proprietário/gerente/recepcionista/assistente/profissional
 * (profissional não deleta — RLS + gate). Totais SEMPRE calculados no
 * servidor (RPC salvar_orcamento) — o cliente não define valores finais.
 */

export type EstadoOrcamento = { erro: string | null; ok?: boolean; id?: string };

export type StatusOrcamento =
  | "rascunho"
  | "enviado"
  | "aprovado"
  | "recusado"
  | "expirado";

export type ItemOrcamentoInput = {
  servico_id: string | null;
  item_estoque_id: string | null;
  quantidade: number;
  valor_unitario: number;
  tipo_valor: "fixo" | "a_partir_de" | "gratuito";
  regioes: string[];
  unidade?: string | null;
  observacao?: string | null;
};

export type OrcamentoInput = {
  id?: string;
  paciente_id: string | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  cliente_email?: string | null;
  profissional_id?: string | null;
  convenio_id?: string | null;
  tabela_preco_id?: string | null;
  status: StatusOrcamento;
  validade_dias: number;
  tipo_desconto: "percentual" | "valor";
  desconto: number;
  observacoes?: string | null;
  anotacoes_internas?: string | null;
  itens: ItemOrcamentoInput[];
};

const PAPEIS_FUNIL = [
  "proprietario",
  "gerente",
  "recepcionista",
  "assistente",
  "profissional",
];

async function exigirFunil() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) {
    return { sessao: null, erro: "Sessão inválida." } as const;
  }
  if (!PAPEIS_FUNIL.includes(sessao.papel ?? "") && !sessao.isAdmin) {
    return { sessao: null, erro: "Sem permissão para gerenciar orçamentos." } as const;
  }
  return { sessao, erro: null } as const;
}

export async function salvarOrcamento(
  input: OrcamentoInput
): Promise<EstadoOrcamento> {
  const { sessao, erro } = await exigirFunil();
  if (!sessao) return { erro };

  // Precisa de paciente OU nome avulso (espelha o CHECK orcamento_cliente_presente)
  if (!input.paciente_id && !input.cliente_nome?.trim()) {
    return { erro: "Informe um paciente ou o nome do cliente." };
  }

  // Cada item precisa de exatamente uma origem: serviço OU produto de estoque
  const itens = (input.itens ?? []).filter(
    (i) => i.servico_id || i.item_estoque_id
  );
  for (const i of itens) {
    if (!!i.servico_id === !!i.item_estoque_id) {
      return { erro: "Item inválido: informe serviço ou produto, não ambos." };
    }
    if (Number(i.quantidade) <= 0) {
      return { erro: "Quantidade dos itens deve ser maior que zero." };
    }
  }

  const orcamentoJson = {
    id: input.id ?? null,
    paciente_id: input.paciente_id ?? null,
    cliente_nome: input.cliente_nome ?? null,
    cliente_telefone: input.cliente_telefone ?? null,
    cliente_email: input.cliente_email ?? null,
    profissional_id: input.profissional_id ?? null,
    convenio_id: input.convenio_id ?? null,
    tabela_preco_id: input.tabela_preco_id ?? null,
    status: input.status ?? "rascunho",
    validade_dias: input.validade_dias ?? 30,
    tipo_desconto: input.tipo_desconto ?? "percentual",
    desconto: Number(input.desconto) || 0,
    observacoes: input.observacoes ?? null,
    anotacoes_internas: input.anotacoes_internas ?? null,
  };

  const itensJson = itens.map((i) => ({
    servico_id: i.servico_id ?? null,
    item_estoque_id: i.item_estoque_id ?? null,
    quantidade: Number(i.quantidade) || 1,
    valor_unitario: Number(i.valor_unitario) || 0,
    tipo_valor: i.tipo_valor ?? "fixo",
    regioes: i.regioes ?? [],
    unidade: i.unidade ?? null,
    observacao: i.observacao ?? null,
  }));

  const supabase = createClient();
  const { data, error } = await supabase.rpc("salvar_orcamento", {
    p_clinica_id: sessao.clinicaAtual!,
    p_orcamento: orcamentoJson as unknown as Json,
    p_itens: itensJson as unknown as Json,
  });

  if (error) {
    return {
      erro:
        error.code === "23514"
          ? "Dados do orçamento inválidos (paciente de outra clínica ou item inconsistente)."
          : error.code === "42501"
            ? "Sem permissão para salvar o orçamento."
            : "Não foi possível salvar o orçamento.",
    };
  }

  revalidatePath("/painel/orcamentos");
  return { erro: null, ok: true, id: (data as string) ?? undefined };
}

export async function moverOrcamentoStatus(
  id: string,
  status: StatusOrcamento
): Promise<EstadoOrcamento> {
  const { sessao, erro } = await exigirFunil();
  if (!sessao) return { erro };

  const supabase = createClient();
  const { error } = await supabase
    .from("orcamento")
    .update({ status })
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual!);

  if (error) return { erro: "Sem permissão para mover o orçamento." };

  revalidatePath("/painel/orcamentos");
  return { erro: null, ok: true };
}

export async function excluirOrcamento(id: string): Promise<EstadoOrcamento> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };
  // Delete: profissional NÃO pode (RLS orcamento_delete exclui profissional).
  if (
    !["proprietario", "gerente", "recepcionista", "assistente"].includes(
      sessao.papel ?? ""
    ) &&
    !sessao.isAdmin
  ) {
    return { erro: "Sem permissão para excluir orçamentos." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("orcamento")
    .delete()
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual);

  if (error) return { erro: "Não foi possível excluir (orçamento já vendido?)." };

  revalidatePath("/painel/orcamentos");
  return { erro: null, ok: true };
}
