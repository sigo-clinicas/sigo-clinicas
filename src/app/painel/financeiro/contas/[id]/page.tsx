import { notFound, redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ContaDetalheClient } from "./conta-detalhe-client";

// Porta de reference/base44 ContaDetalhe.jsx + Conciliacao.jsx — extrato da
// conta (movimentacao_conta), lançamentos vinculados e conciliação manual.
export default async function ContaDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");
  const podeGerir =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;
  if (!podeGerir) redirect("/painel");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;
  const contaId = params.id;

  const { data: conta } = await supabase
    .from("conta_bancaria")
    .select("id,nome,tipo,saldo_inicial")
    .eq("id", contaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (!conta) notFound();

  const [{ data: saldo }, { data: movimentacoes }, { data: baixas }] = await Promise.all([
    supabase
      .from("saldo_conta_bancaria")
      .select("saldo_atual")
      .eq("conta_bancaria_id", contaId)
      .maybeSingle(),
    supabase
      .from("movimentacao_conta")
      .select("id,lancamento_id,tipo,descricao,valor,data,conciliada,observacao")
      .eq("clinica_id", clinicaId)
      .eq("conta_bancaria_id", contaId)
      .order("data", { ascending: true }),
    supabase
      .from("baixa_lancamento")
      .select("id,movimentacao_conta_id,lancamento_id")
      .eq("clinica_id", clinicaId)
      .eq("conta_bancaria_id", contaId),
  ]);

  const lancIds = [
    ...new Set((movimentacoes ?? []).map((m) => m.lancamento_id).filter(Boolean)),
  ] as string[];
  const { data: lancamentos } = lancIds.length
    ? await supabase
        .from("lancamento_financeiro")
        .select("id,tipo,descricao,valor,valor_pago,data_vencimento,status,venda_id")
        .eq("clinica_id", clinicaId)
        .in("id", lancIds)
    : { data: [] };

  const baixaPorMov: Record<string, string> = {};
  for (const b of baixas ?? []) {
    if (b.movimentacao_conta_id) baixaPorMov[b.movimentacao_conta_id] = b.id;
  }

  return (
    <ContaDetalheClient
      conta={{ ...conta, saldo_atual: Number(saldo?.saldo_atual ?? conta.saldo_inicial) }}
      movimentacoes={movimentacoes ?? []}
      lancamentos={lancamentos ?? []}
      baixaPorMov={baixaPorMov}
    />
  );
}
