import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { CampanhasClient } from "./campanhas-client";

// Porta de reference/base44 src/pages/marketing/Campanhas.jsx. Segmentação +
// preview de público-alvo (RPC campanha_publico_alvo). Disparo real = F2 (A5).
export default async function CampanhasPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");
  const podeGerir =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;
  if (!podeGerir) redirect("/painel");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;
  const [{ data: campanhas }, { data: cidades }] = await Promise.all([
    supabase
      .from("campanha")
      .select("id,nome,descricao,status,filtros,canais,conteudo,data_agendado,quantidade_destinatarios,created_at")
      .eq("clinica_id", clinicaId)
      .order("created_at", { ascending: false }),
    supabase
      .from("paciente_clinica")
      .select("paciente:paciente_id(cidade)")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true),
  ]);

  const listaCidades = [
    ...new Set(
      (cidades ?? [])
        .map((c) => (c.paciente as { cidade: string | null } | null)?.cidade)
        .filter(Boolean) as string[]
    ),
  ].sort();

  return <CampanhasClient campanhas={campanhas ?? []} cidades={listaCidades} />;
}
