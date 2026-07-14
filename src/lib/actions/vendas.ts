"use server";

import { revalidatePath } from "next/cache";
import { addMonths, format } from "date-fns";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

/**
 * S3-2 — Botão "Vender" (porta de reference/base44 VendaModal.jsx).
 * Calcula as parcelas no SERVIDOR (iguais, a última absorve o resto → somam
 * exato) e chama a RPC transacional vender_orcamento. Escrita: papéis do funil
 * de venda (sem profissional). valor_final vem do DB, nunca do cliente.
 */

export type EstadoVenda = { erro: string | null; ok?: boolean; id?: string };

export type FormaPagamento =
  | "dinheiro"
  | "cartao_debito"
  | "cartao_credito"
  | "pix"
  | "transferencia"
  | "boleto"
  | "convenio"
  | "outro";

const PAPEIS_VENDA = ["proprietario", "gerente", "recepcionista", "assistente"];

export async function venderOrcamento(input: {
  orcamento_id: string;
  forma_pagamento: FormaPagamento;
  data_venda: string; // YYYY-MM-DD
  parcelas: number;
}): Promise<EstadoVenda> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };
  if (!PAPEIS_VENDA.includes(sessao.papel ?? "") && !sessao.isAdmin) {
    return { erro: "Sem permissão para vender." };
  }

  const supabase = createClient();
  const { data: orc, error: errOrc } = await supabase
    .from("orcamento")
    .select("valor_final,status")
    .eq("id", input.orcamento_id)
    .eq("clinica_id", sessao.clinicaAtual)
    .single();
  if (errOrc || !orc) return { erro: "Orçamento não encontrado." };
  if (orc.status !== "aprovado") {
    return { erro: "Só é possível vender um orçamento aprovado." };
  }

  const valorFinal = Number(orc.valor_final);
  const n = Math.max(1, Math.min(12, Math.floor(input.parcelas) || 1));
  const dataVenda = input.data_venda || new Date().toISOString().slice(0, 10);
  const base = Math.floor((valorFinal / n) * 100) / 100;
  const parcelas = Array.from({ length: n }, (_, i) => {
    const numero = i + 1;
    const valor =
      numero < n
        ? base
        : Math.round((valorFinal - base * (n - 1)) * 100) / 100;
    const vencimento = format(
      addMonths(new Date(`${dataVenda}T00:00:00`), i),
      "yyyy-MM-dd"
    );
    return { numero, valor, vencimento };
  });

  const { data, error } = await supabase.rpc("vender_orcamento", {
    p_clinica_id: sessao.clinicaAtual,
    p_orcamento_id: input.orcamento_id,
    p_forma_pagamento: input.forma_pagamento,
    p_data_venda: dataVenda,
    p_parcelas: parcelas as unknown as Json,
  });

  if (error) {
    return {
      erro:
        error.code === "23505"
          ? "Este orçamento já foi vendido."
          : error.code === "23514"
            ? "Não foi possível vender (orçamento não aprovado ou parcelas inválidas)."
            : error.code === "42501"
              ? "Sem permissão para vender."
              : "Não foi possível concluir a venda.",
    };
  }

  revalidatePath("/painel/orcamentos");
  return { erro: null, ok: true, id: data as string };
}
