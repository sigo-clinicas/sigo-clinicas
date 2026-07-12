"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * S2-1 — Estoque-núcleo. Escrita: proprietário/gerente (matriz do legado).
 * Saldo é SEMPRE derivado da view saldo_item_estoque (nunca coluna — A3/A6).
 * - Item: CRUD via client da sessão (RLS decide).
 * - Entrada: Server Action com insert em lote atômico; requer_validade
 *   validado no servidor. NÃO gera financeiro no S2 (→S3).
 * - Saída: RPC registrar_saida_estoque (bloqueio de saldo + lock atômico).
 */

export type EstadoEstoque = { erro: string | null; ok?: boolean };

export type ItemInput = {
  id?: string;
  codigo?: string | null;
  descricao: string;
  classificacao:
    | "material_consumo"
    | "medicamento"
    | "equipamento"
    | "limpeza"
    | "descartavel"
    | "produto_venda"
    | "outros";
  categoria?: string | null;
  requer_validade: boolean;
  unidade?: string | null;
  preco_custo?: number | null;
  preco_venda?: number | null;
  para_venda: boolean;
  estoque_minimo: number;
  fornecedor?: string | null;
  ativo: boolean;
};

async function exigirGestaoEstoque() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) {
    return { sessao: null, erro: "Sessão inválida." } as const;
  }
  if (
    !["proprietario", "gerente"].includes(sessao.papel ?? "") &&
    !sessao.isAdmin
  ) {
    return { sessao: null, erro: "Sem permissão para gerenciar o estoque." } as const;
  }
  return { sessao, erro: null } as const;
}

export async function salvarItem(input: ItemInput): Promise<EstadoEstoque> {
  const { sessao, erro } = await exigirGestaoEstoque();
  if (!sessao) return { erro };
  if (!input.descricao.trim()) return { erro: "Informe a descrição do item." };

  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual!,
    codigo: input.codigo || null,
    descricao: input.descricao.trim(),
    classificacao: input.classificacao,
    categoria: input.categoria || null,
    requer_validade: input.requer_validade,
    unidade: input.unidade || null,
    preco_custo: input.preco_custo ?? null,
    preco_venda: input.preco_venda ?? null,
    para_venda: input.para_venda,
    estoque_minimo: input.estoque_minimo || 0,
    fornecedor: input.fornecedor || null,
    ativo: input.ativo,
  };

  const { error } = input.id
    ? await supabase
        .from("item_estoque")
        .update(dados)
        .eq("id", input.id)
        .eq("clinica_id", sessao.clinicaAtual!)
    : await supabase.from("item_estoque").insert(dados);

  if (error) {
    return {
      erro:
        error.code === "23505"
          ? "Já existe um item com esta descrição."
          : "Sem permissão para salvar o item.",
    };
  }

  revalidatePath("/painel/estoque");
  return { erro: null, ok: true };
}

export async function excluirItem(id: string): Promise<EstadoEstoque> {
  const { sessao, erro } = await exigirGestaoEstoque();
  if (!sessao) return { erro };

  const supabase = createClient();
  const { error } = await supabase
    .from("item_estoque")
    .delete()
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Sem permissão para excluir (item com movimentações?)." };

  revalidatePath("/painel/estoque");
  return { erro: null, ok: true };
}

export type LinhaEntrada = {
  item_id: string;
  quantidade: number;
  preco_unitario?: number | null;
  lote?: string | null;
  validade?: string | null;
};

export async function registrarEntrada(input: {
  data: string;
  fornecedor?: string | null;
  observacao?: string | null;
  centro_custo_id?: string | null;
  linhas: LinhaEntrada[];
}): Promise<EstadoEstoque> {
  const { sessao, erro } = await exigirGestaoEstoque();
  if (!sessao) return { erro };

  const linhas = input.linhas.filter(
    (l) => l.item_id && Number(l.quantidade) > 0
  );
  if (linhas.length === 0) return { erro: "Adicione ao menos um item." };

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual!;

  // Validação server-side de requer_validade (não confiar só no form)
  const itemIds = [...new Set(linhas.map((l) => l.item_id))];
  const { data: itens } = await supabase
    .from("item_estoque")
    .select("id,descricao,requer_validade")
    .eq("clinica_id", clinicaId)
    .in("id", itemIds);

  const porId = new Map((itens ?? []).map((i) => [i.id, i]));
  for (const l of linhas) {
    const item = porId.get(l.item_id);
    if (!item) return { erro: "Item de outra clínica na entrada." };
    if (item.requer_validade && !l.validade) {
      return { erro: `Informe a validade para "${item.descricao}".` };
    }
  }

  // Insert em lote — atômico. Sem lançamento financeiro no S2 (→S3).
  const { error } = await supabase.from("movimentacao_estoque").insert(
    linhas.map((l) => {
      const qtd = Number(l.quantidade);
      const preco = l.preco_unitario ? Number(l.preco_unitario) : null;
      return {
        clinica_id: clinicaId,
        item_id: l.item_id,
        tipo: "entrada" as const,
        quantidade: qtd,
        preco_unitario: preco,
        valor_total: preco != null ? qtd * preco : null,
        data: input.data || new Date().toISOString().slice(0, 10),
        fornecedor: input.fornecedor || null,
        lote: l.lote || null,
        validade: l.validade || null,
        centro_custo_id: input.centro_custo_id || null,
        observacao: input.observacao || null,
      };
    })
  );

  if (error) return { erro: "Sem permissão para registrar a entrada." };

  revalidatePath("/painel/estoque");
  return { erro: null, ok: true };
}

export async function registrarSaida(input: {
  data: string;
  observacao?: string | null;
  linhas: { item_id: string; quantidade: number }[];
}): Promise<EstadoEstoque> {
  const { sessao, erro } = await exigirGestaoEstoque();
  if (!sessao) return { erro };

  const linhas = input.linhas.filter(
    (l) => l.item_id && Number(l.quantidade) > 0
  );
  if (linhas.length === 0) return { erro: "Adicione ao menos um item." };

  const supabase = createClient();
  const { error } = await supabase.rpc("registrar_saida_estoque", {
    p_clinica_id: sessao.clinicaAtual!,
    p_data: input.data || new Date().toISOString().slice(0, 10),
    p_observacao: input.observacao || "", // a RPC faz nullif('') → null

    p_linhas: linhas.map((l) => ({
      item_id: l.item_id,
      quantidade: Number(l.quantidade),
    })),
  });

  if (error) {
    // 23514 = saldo insuficiente / item de outra clínica (mensagem da RPC)
    return {
      erro:
        error.code === "23514"
          ? "Saldo insuficiente para a saída."
          : error.code === "42501"
            ? "Sem permissão para registrar saída."
            : "Não foi possível registrar a saída.",
    };
  }

  revalidatePath("/painel/estoque");
  return { erro: null, ok: true };
}
