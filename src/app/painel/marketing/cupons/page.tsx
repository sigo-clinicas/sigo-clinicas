import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { CuponsClient } from "./cupons-client";

// S3-6 — CRUD de cupons no painel (proprietário/gerente). O cupom com
// status 'ativo' aparece no marketplace (policy cupom_select_marketplace).
export default async function CuponsPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");
  const podeGerir =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;
  if (!podeGerir) redirect("/painel");

  const supabase = createClient();
  const { data: cupons } = await supabase
    .from("cupom")
    .select(
      "id,codigo,tipo_desconto,valor_desconto,descricao,status,validade_inicio,validade_fim,regras_uso,quantidade_usos"
    )
    .eq("clinica_id", sessao.clinicaAtual)
    .order("created_at", { ascending: false });

  return <CuponsClient cupons={cupons ?? []} />;
}
