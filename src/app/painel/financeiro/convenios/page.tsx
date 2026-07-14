import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ConveniosTabs } from "./convenios-tabs";

// Porta de reference/base44 src/pages/financeiro/Convenios.jsx: CRUD do cadastro
// + FECHAMENTO DE GUIA via CSV (S4-5). O fechamento é restrito a
// proprietário/gerente (financeiro); a baixa em lote nasce em RPC transacional.
export default async function ConveniosPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const [{ data: convenios }, { data: contas }] = await Promise.all([
    supabase
      .from("convenio")
      .select("id,nome,codigo,tipo,contato,prazo_pagamento_dias,observacoes,ativo")
      .eq("clinica_id", sessao.clinicaAtual)
      .order("nome"),
    supabase
      .from("conta_bancaria")
      .select("id,nome")
      .eq("clinica_id", sessao.clinicaAtual)
      .eq("ativo", true)
      .order("nome"),
  ]);

  const podeGerenciar =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;

  return (
    <ConveniosTabs
      convenios={convenios ?? []}
      contas={contas ?? []}
      podeGerenciar={podeGerenciar}
    />
  );
}
