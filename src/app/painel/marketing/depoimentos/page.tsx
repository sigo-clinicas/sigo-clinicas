import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { DepoimentosClient } from "./depoimentos-client";

// Porta de reference/base44 src/pages/marketing/Depoimentos.jsx. Moderação +
// publicação; aprovados+publicados alimentam marketplace_ranking_score (S3-6).
export default async function DepoimentosPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");
  const podeGerir =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;
  if (!podeGerir) redirect("/painel");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;
  const [{ data: depoimentos }, { data: profissionais }, { data: servicos }] =
    await Promise.all([
      supabase
        .from("depoimento")
        .select(
          "id,paciente_nome,texto,nota,profissional_id,servico_id,status,publicar_no_site,destaque,origem,created_at"
        )
        .eq("clinica_id", clinicaId)
        .order("created_at", { ascending: false }),
      supabase.from("profissional").select("id,nome").eq("clinica_id", clinicaId).eq("ativo", true).order("nome"),
      supabase.from("servico").select("id,nome").eq("clinica_id", clinicaId).eq("ativo", true).order("nome"),
    ]);

  return (
    <DepoimentosClient
      depoimentos={depoimentos ?? []}
      profissionais={profissionais ?? []}
      servicos={servicos ?? []}
    />
  );
}
