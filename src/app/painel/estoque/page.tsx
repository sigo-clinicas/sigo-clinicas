import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { EstoqueClient } from "./estoque-client";

// Porta de reference/base44 src/pages/Estoque.jsx + modais (ItemEstoqueModal,
// EntradaEstoqueModal, SaidaEstoqueModal). Mudanças estruturais:
// (1) saldo vem da view saldo_item_estoque (nunca coluna saldo_atual — A3);
// (2) entrada = Server Action (sem financeiro no S2, →S3); saída = RPC com
// bloqueio de saldo + lock. Composição de serviço e edição de movimentação
// entram no S2-3 (junto da baixa de insumos) — sinalizado.
export default async function EstoquePage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const [{ data: itens }, { data: saldos }, { data: movimentacoes }, { data: centros }] =
    await Promise.all([
      supabase
        .from("item_estoque")
        .select(
          "id,codigo,descricao,classificacao,categoria,requer_validade,unidade,preco_custo,preco_venda,para_venda,estoque_minimo,fornecedor,ativo"
        )
        .eq("clinica_id", clinicaId)
        .eq("ativo", true)
        .order("descricao"),
      supabase
        .from("saldo_item_estoque")
        .select("item_id,saldo_atual")
        .eq("clinica_id", clinicaId),
      supabase
        .from("movimentacao_estoque")
        .select(
          "id,item_id,tipo,quantidade,preco_unitario,valor_total,data,fornecedor,lote,validade,observacao"
        )
        .eq("clinica_id", clinicaId)
        .order("data", { ascending: false })
        .limit(500),
      supabase
        .from("centro_custo")
        .select("id,nome")
        .eq("clinica_id", clinicaId)
        .eq("ativo", true)
        .order("nome"),
    ]);

  const saldoPorItem = new Map(
    (saldos ?? []).map((s) => [s.item_id, Number(s.saldo_atual)])
  );
  const itensComSaldo = (itens ?? []).map((it) => ({
    ...it,
    saldo: saldoPorItem.get(it.id) ?? 0,
  }));

  const podeGerenciar =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;

  return (
    <EstoqueClient
      itens={itensComSaldo}
      movimentacoes={movimentacoes ?? []}
      centros={centros ?? []}
      podeGerenciar={podeGerenciar}
    />
  );
}
