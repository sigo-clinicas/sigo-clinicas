import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ConveniosClient } from "./convenios-client";

// Porta (parcial) de reference/base44 src/pages/financeiro/Convenios.jsx:
// CRUD do cadastro de convênios. O FECHAMENTO DE GUIA via CSV da tela
// original entra no S4 (D4.4) — não é remoção de escopo, é faseamento do
// roadmap aprovado.
export default async function ConveniosPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const { data: convenios } = await supabase
    .from("convenio")
    .select("id,nome,codigo,tipo,contato,prazo_pagamento_dias,observacoes,ativo")
    .eq("clinica_id", sessao.clinicaAtual)
    .order("nome");

  const podeGerenciar =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;

  return (
    <ConveniosClient convenios={convenios ?? []} podeGerenciar={podeGerenciar} />
  );
}
