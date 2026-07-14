import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ContasClient } from "./contas-client";

// Porta de reference/base44 src/pages/financeiro/Contas.jsx (+ ConfiguracoesConta
// dobrada aqui). Saldo SEMPRE da view saldo_conta_bancaria (nunca coluna).
export default async function ContasPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");
  const podeGerir =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;
  if (!podeGerir) redirect("/painel");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const [{ data: contas }, { data: saldos }, { data: categorias }, { data: centros }] =
    await Promise.all([
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
    <ContasClient
      contas={contasComSaldo}
      categorias={categorias ?? []}
      centros={centros ?? []}
    />
  );
}
