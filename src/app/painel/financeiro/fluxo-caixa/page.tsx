import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { FluxoCaixaClient } from "./fluxo-caixa-client";

// Porta de reference/base44 src/pages/financeiro/FluxoCaixa.jsx. Financeiro é
// restrito a proprietário/gerente (RLS). Saldo/recebíveis derivam de
// lancamento_financeiro; a baixa é RPC (movimentacao_conta transacional).
export default async function FluxoCaixaPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");
  const podeGerir =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;
  if (!podeGerir) redirect("/painel");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const [{ data: lancamentos }, { data: contas }, { data: saldos }, { data: categorias }, { data: centros }] =
    await Promise.all([
      supabase
        .from("lancamento_financeiro")
        .select(
          "id,tipo,descricao,valor,valor_pago,data_vencimento,data_pagamento,status,categoria_id,centro_custo_id,forma_pagamento,paciente_id,venda_id,observacoes"
        )
        .eq("clinica_id", clinicaId)
        .order("data_vencimento", { ascending: false })
        .limit(500),
      supabase
        .from("conta_bancaria")
        .select("id,nome,tipo,banco,agencia,numero_conta,saldo_inicial,ativo")
        .eq("clinica_id", clinicaId)
        .order("nome"),
      supabase
        .from("saldo_conta_bancaria")
        .select("conta_bancaria_id,saldo_atual")
        .eq("clinica_id", clinicaId),
      supabase
        .from("categoria_lancamento")
        .select("id,nome,tipo,descricao,pai_id,ordem,ativo")
        .eq("clinica_id", clinicaId)
        .order("ordem"),
      supabase
        .from("centro_custo")
        .select("id,nome,descricao,cor,ativo")
        .eq("clinica_id", clinicaId)
        .order("nome"),
    ]);

  const saldoPorConta = new Map(
    (saldos ?? []).map((s) => [s.conta_bancaria_id, Number(s.saldo_atual)])
  );
  const contasComSaldo = (contas ?? []).map((c) => ({
    ...c,
    saldo_atual: saldoPorConta.get(c.id) ?? Number(c.saldo_inicial),
  }));

  return (
    <FluxoCaixaClient
      lancamentos={lancamentos ?? []}
      contas={contasComSaldo}
      categorias={categorias ?? []}
      centros={centros ?? []}
    />
  );
}
