"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * S3-3 — Financeiro núcleo (porta de reference/base44 FluxoCaixa/Contas/
 * LancamentoModal/FecharContaModal). Escrita restrita a proprietário/gerente
 * (RLS + gate). Cadastro de conta/categoria/centro e de lançamentos é CRUD
 * direto (RLS decide); a BAIXA e o ESTORNO nascem em RPC transacional — nunca
 * INSERT de movimentacao_conta pela UI (corrige A6). Saldo vem da view.
 */

export type EstadoFin = { erro: string | null; ok?: boolean; id?: string };

type TipoLancamento = "receita" | "despesa";
type FormaPagamento =
  | "dinheiro"
  | "cartao_debito"
  | "cartao_credito"
  | "pix"
  | "transferencia"
  | "boleto"
  | "convenio"
  | "outro";

export type ContaBancariaInput = {
  id?: string;
  nome: string;
  tipo: "conta_corrente" | "cartao_credito" | "comissao" | "caixa" | "outro";
  banco?: string | null;
  agencia?: string | null;
  numero_conta?: string | null;
  saldo_inicial: number;
  ativo: boolean;
};

export type CategoriaInput = {
  id?: string;
  nome: string;
  tipo: TipoLancamento;
  descricao?: string | null;
  pai_id?: string | null;
  ordem?: number;
  ativo: boolean;
};

export type CentroCustoInput = {
  id?: string;
  nome: string;
  descricao?: string | null;
  cor?: string | null;
  ativo: boolean;
};

export type LancamentoInput = {
  id?: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  data_vencimento: string;
  categoria_id?: string | null;
  centro_custo_id?: string | null;
  forma_pagamento?: FormaPagamento | null;
  paciente_id?: string | null;
  convenio_id?: string | null;
  profissional_id?: string | null;
  observacoes?: string | null;
};

async function exigirFinanceiro() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) {
    return { sessao: null, erro: "Sessão inválida." } as const;
  }
  if (!["proprietario", "gerente"].includes(sessao.papel ?? "") && !sessao.isAdmin) {
    return { sessao: null, erro: "Sem permissão para o financeiro." } as const;
  }
  return { sessao, erro: null } as const;
}

// ---- Conta bancária ---------------------------------------------------------

export async function salvarConta(input: ContaBancariaInput): Promise<EstadoFin> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  if (!input.nome.trim()) return { erro: "Informe o nome da conta." };

  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual!,
    nome: input.nome.trim(),
    tipo: input.tipo,
    banco: input.banco || null,
    agencia: input.agencia || null,
    numero_conta: input.numero_conta || null,
    saldo_inicial: Number(input.saldo_inicial) || 0,
    ativo: input.ativo,
  };
  const { error } = input.id
    ? await supabase.from("conta_bancaria").update(dados).eq("id", input.id).eq("clinica_id", sessao.clinicaAtual!)
    : await supabase.from("conta_bancaria").insert(dados);
  if (error) {
    return { erro: error.code === "23505" ? "Já existe uma conta com esse nome." : "Sem permissão para salvar a conta." };
  }
  revalidatePath("/painel/financeiro/contas");
  return { erro: null, ok: true };
}

export async function excluirConta(id: string): Promise<EstadoFin> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase.from("conta_bancaria").delete().eq("id", id).eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Não foi possível excluir (conta com movimentações?)." };
  revalidatePath("/painel/financeiro/contas");
  return { erro: null, ok: true };
}

// ---- Categoria --------------------------------------------------------------

export async function salvarCategoria(input: CategoriaInput): Promise<EstadoFin> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  if (!input.nome.trim()) return { erro: "Informe o nome da categoria." };

  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual!,
    nome: input.nome.trim(),
    tipo: input.tipo,
    descricao: input.descricao || null,
    pai_id: input.pai_id || null,
    ordem: input.ordem ?? 0,
    ativo: input.ativo,
  };
  const { error } = input.id
    ? await supabase.from("categoria_lancamento").update(dados).eq("id", input.id).eq("clinica_id", sessao.clinicaAtual!)
    : await supabase.from("categoria_lancamento").insert(dados);
  if (error) {
    return { erro: error.code === "23505" ? "Já existe uma categoria com esse nome e tipo." : "Sem permissão para salvar a categoria." };
  }
  revalidatePath("/painel/financeiro/contas");
  return { erro: null, ok: true };
}

export async function excluirCategoria(id: string): Promise<EstadoFin> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase.from("categoria_lancamento").delete().eq("id", id).eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Não foi possível excluir a categoria." };
  revalidatePath("/painel/financeiro/contas");
  return { erro: null, ok: true };
}

// ---- Centro de custo --------------------------------------------------------

export async function salvarCentroCusto(input: CentroCustoInput): Promise<EstadoFin> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  if (!input.nome.trim()) return { erro: "Informe o nome do centro de custo." };

  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual!,
    nome: input.nome.trim(),
    descricao: input.descricao || null,
    cor: input.cor || null,
    ativo: input.ativo,
  };
  const { error } = input.id
    ? await supabase.from("centro_custo").update(dados).eq("id", input.id).eq("clinica_id", sessao.clinicaAtual!)
    : await supabase.from("centro_custo").insert(dados);
  if (error) {
    return { erro: error.code === "23505" ? "Já existe um centro de custo com esse nome." : "Sem permissão para salvar." };
  }
  revalidatePath("/painel/financeiro/contas");
  return { erro: null, ok: true };
}

export async function excluirCentroCusto(id: string): Promise<EstadoFin> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase.from("centro_custo").delete().eq("id", id).eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Não foi possível excluir o centro de custo." };
  revalidatePath("/painel/financeiro/contas");
  return { erro: null, ok: true };
}

// ---- Lançamento (cadastro; a baixa é RPC) -----------------------------------

export async function salvarLancamento(input: LancamentoInput): Promise<EstadoFin> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  if (!input.descricao.trim()) return { erro: "Informe a descrição do lançamento." };
  if (Number(input.valor) <= 0) return { erro: "Valor deve ser maior que zero." };

  const supabase = createClient();

  // Lançamentos gerados por venda são read-only (origem no funil comercial)
  if (input.id) {
    const { data: existente } = await supabase
      .from("lancamento_financeiro")
      .select("venda_id")
      .eq("id", input.id)
      .eq("clinica_id", sessao.clinicaAtual!)
      .single();
    if (existente?.venda_id) {
      return { erro: "Lançamento gerado por venda não pode ser editado aqui." };
    }
  }

  const dados = {
    clinica_id: sessao.clinicaAtual!,
    tipo: input.tipo,
    descricao: input.descricao.trim(),
    valor: Number(input.valor),
    data_vencimento: input.data_vencimento,
    categoria_id: input.categoria_id || null,
    centro_custo_id: input.centro_custo_id || null,
    forma_pagamento: input.forma_pagamento || null,
    paciente_id: input.paciente_id || null,
    convenio_id: input.convenio_id || null,
    profissional_id: input.profissional_id || null,
    observacoes: input.observacoes || null,
  };
  const { error } = input.id
    ? await supabase.from("lancamento_financeiro").update(dados).eq("id", input.id).eq("clinica_id", sessao.clinicaAtual!)
    : await supabase.from("lancamento_financeiro").insert(dados);
  if (error) return { erro: "Não foi possível salvar o lançamento." };

  revalidatePath("/painel/financeiro/fluxo-caixa");
  return { erro: null, ok: true };
}

export async function excluirLancamento(id: string): Promise<EstadoFin> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { data: existente } = await supabase
    .from("lancamento_financeiro")
    .select("venda_id")
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual!)
    .single();
  if (existente?.venda_id) return { erro: "Lançamento gerado por venda não pode ser excluído aqui." };

  const { error } = await supabase.from("lancamento_financeiro").delete().eq("id", id).eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Não foi possível excluir (lançamento com baixas?)." };
  revalidatePath("/painel/financeiro/fluxo-caixa");
  return { erro: null, ok: true };
}

// ---- Baixa / estorno (RPC transacional) -------------------------------------

export async function registrarBaixa(input: {
  lancamento_id: string;
  conta_id: string;
  valor: number;
  data: string;
  forma?: FormaPagamento | null;
  observacao?: string | null;
}): Promise<EstadoFin> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  if (Number(input.valor) <= 0) return { erro: "Valor da baixa deve ser positivo." };
  if (!input.conta_id) return { erro: "Selecione a conta bancária." };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("registrar_baixa_lancamento", {
    p_clinica_id: sessao.clinicaAtual!,
    p_lancamento_id: input.lancamento_id,
    p_conta_id: input.conta_id,
    p_valor: Number(input.valor),
    p_data: input.data || new Date().toISOString().slice(0, 10),
    p_forma: input.forma ?? "outro",
    p_obs: input.observacao || "",
  });
  if (error) {
    return {
      erro:
        error.code === "23514"
          ? "Baixa inválida (valor acima do saldo em aberto ou conta/lançamento de outra clínica)."
          : error.code === "42501"
            ? "Sem permissão para dar baixa."
            : "Não foi possível registrar a baixa.",
    };
  }
  revalidatePath("/painel/financeiro/fluxo-caixa");
  revalidatePath("/painel/financeiro/contas");
  return { erro: null, ok: true, id: data as string };
}

export async function estornarBaixa(baixaId: string): Promise<EstadoFin> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase.rpc("estornar_baixa_lancamento", {
    p_clinica_id: sessao.clinicaAtual!,
    p_baixa_id: baixaId,
  });
  if (error) {
    return { erro: error.code === "42501" ? "Sem permissão para estornar." : "Não foi possível estornar a baixa." };
  }
  revalidatePath("/painel/financeiro/fluxo-caixa");
  revalidatePath("/painel/financeiro/contas");
  return { erro: null, ok: true };
}

// ---- Conciliação (só o flag conciliada; policy movimentacao_conciliar) -------

export async function conciliarMovimentacao(
  id: string,
  conciliada: boolean
): Promise<EstadoFin> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase
    .from("movimentacao_conta")
    .update({ conciliada })
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Sem permissão para conciliar." };
  revalidatePath("/painel/financeiro/contas");
  return { erro: null, ok: true };
}
