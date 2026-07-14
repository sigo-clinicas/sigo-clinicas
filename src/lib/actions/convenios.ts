"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

/**
 * S4-5 — Fechamento de guia por convênio (buffer da Fase 1). Tudo aqui é
 * restrito a proprietário/gerente (matriz financeira). Dinheiro só se move via
 * RPC transacional (gerar_recebiveis_convenio / registrar_baixa_lote_convenio):
 * a UI nunca insere lançamento/movimentação direto.
 */

type FormaPagamento =
  | "dinheiro"
  | "cartao_debito"
  | "cartao_credito"
  | "pix"
  | "transferencia"
  | "boleto"
  | "convenio"
  | "outro";

export type EstadoConvenio = { erro: string | null; ok?: boolean };

export type AtendimentoFechamento = {
  lancamento_id: string;
  numero_guia: string | null;
  paciente_nome: string | null;
  data: string | null;
  valor: number;
  valor_pago: number;
  valor_devido: number;
  status: string;
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

/** Contas a receber (já geradas) em aberto de um convênio — base da conciliação. */
export async function atendimentosParaFechamento(
  convenioId: string
): Promise<{ erro: string | null; atendimentos: AtendimentoFechamento[] }> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro, atendimentos: [] };
  if (!convenioId) return { erro: "Selecione o convênio.", atendimentos: [] };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("lancamento_financeiro")
    .select(
      `id,valor,valor_pago,status,
       consulta:consulta(numero_guia,data_hora),
       paciente:paciente(nome)`
    )
    .eq("clinica_id", sessao.clinicaAtual!)
    .eq("convenio_id", convenioId)
    .eq("tipo", "receita")
    .in("status", ["pendente", "pago_parcial"])
    .order("created_at");
  if (error) return { erro: "Não foi possível carregar as guias.", atendimentos: [] };

  const atendimentos: AtendimentoFechamento[] = (data ?? []).map((l) => {
    const valor = Number(l.valor);
    const valor_pago = Number(l.valor_pago);
    return {
      lancamento_id: l.id,
      numero_guia: l.consulta?.numero_guia ?? null,
      paciente_nome: l.paciente?.nome ?? null,
      data: l.consulta?.data_hora ?? null,
      valor,
      valor_pago,
      valor_devido: Number((valor - valor_pago).toFixed(2)),
      status: l.status,
    };
  });
  return { erro: null, atendimentos };
}

/** Gera contas a receber (uma por consulta concluída no período). Idempotente. */
export async function gerarRecebiveisConvenio(input: {
  convenio_id: string;
  ini: string;
  fim: string;
}): Promise<{ erro: string | null; criados?: number; total?: number }> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  if (!input.convenio_id) return { erro: "Selecione o convênio." };
  if (!input.ini || !input.fim) return { erro: "Informe o período." };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("gerar_recebiveis_convenio", {
    p_clinica_id: sessao.clinicaAtual!,
    p_convenio_id: input.convenio_id,
    p_ini: input.ini,
    p_fim: input.fim,
    p_categoria_id: undefined,
  });
  if (error) {
    return {
      erro:
        error.code === "42501"
          ? "Sem permissão."
          : error.code === "23514"
            ? "Convênio de outra clínica."
            : "Não foi possível gerar os recebíveis.",
    };
  }
  const r = data as { criados: number; total: number };
  revalidatePath("/painel/financeiro/convenios");
  return { erro: null, criados: Number(r.criados), total: Number(r.total) };
}

/** Baixa em lote (fechamento) — transação única no Postgres. */
export async function registrarBaixaLoteConvenio(input: {
  conta_id: string;
  forma: FormaPagamento;
  data: string;
  itens: { lancamento_id: string; valor: number }[];
}): Promise<{ erro: string | null; baixados?: number; total?: number }> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  if (!input.conta_id) return { erro: "Selecione a conta bancária." };
  if (!input.itens || input.itens.length === 0) {
    return { erro: "Nenhuma guia paga para baixar." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("registrar_baixa_lote_convenio", {
    p_clinica_id: sessao.clinicaAtual!,
    p_conta_id: input.conta_id,
    p_forma: input.forma,
    p_data: input.data || new Date().toISOString().slice(0, 10),
    p_itens: input.itens as unknown as Json,
  });
  if (error) {
    return {
      erro:
        error.code === "42501"
          ? "Sem permissão para dar baixa."
          : error.code === "23514"
            ? "Baixa inválida (valor acima do saldo ou lançamento de outra clínica)."
            : "Não foi possível registrar o fechamento.",
    };
  }
  const r = data as { baixados: number; total: number };
  revalidatePath("/painel/financeiro/convenios");
  revalidatePath("/painel/financeiro/fluxo-caixa");
  return { erro: null, baixados: Number(r.baixados), total: Number(r.total) };
}
