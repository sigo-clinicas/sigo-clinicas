import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ComissoesClient } from "./comissoes-client";

// Porta de reference/base44 src/pages/financeiro/Comissoes.jsx. Apuração por
// profissional → lançamento (despesa) via RPC transacional. proprietário/gerente.
export default async function ComissoesPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");
  const podeGerir =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;
  if (!podeGerir) redirect("/painel");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const [{ data: profissionais }, { data: categorias }, { data: historico }] =
    await Promise.all([
      supabase
        .from("profissional")
        .select("id,nome")
        .eq("clinica_id", clinicaId)
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("categoria_lancamento")
        .select("id,nome")
        .eq("clinica_id", clinicaId)
        .eq("tipo", "despesa")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("lancamento_financeiro")
        .select("id,descricao,valor,valor_pago,status,data_vencimento,profissional_id")
        .eq("clinica_id", clinicaId)
        .eq("tipo", "despesa")
        .ilike("observacoes", "Apuração de comissão%")
        .order("data_vencimento", { ascending: false })
        .limit(100),
    ]);

  return (
    <ComissoesClient
      profissionais={profissionais ?? []}
      categorias={categorias ?? []}
      historico={historico ?? []}
    />
  );
}
