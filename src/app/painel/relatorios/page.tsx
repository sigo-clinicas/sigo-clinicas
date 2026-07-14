import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { kpisConfigurados, type ResumoDashboard } from "@/lib/relatorios/kpis";

import { RelatoriosClient } from "./relatorios-client";

export const dynamic = "force-dynamic";

// Porta de reference/base44 src/pages/Relatorios.jsx. Agrega no Postgres (RPC
// relatorio_dashboard). Financeiro por regime de caixa — reconcilia com o S3.
export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: { ini?: string; fim?: string };
}) {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");
  const podeGerir =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;
  if (!podeGerir) redirect("/painel");

  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ini = searchParams.ini || primeiroDia.toISOString().slice(0, 10);
  const fim = searchParams.fim || hoje.toISOString().slice(0, 10);

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const [{ data: resumoJson }, { data: clinica }, { data: profissionais }, { data: servicos }] =
    await Promise.all([
      supabase.rpc("relatorio_dashboard", { p_clinica_id: clinicaId, p_ini: ini, p_fim: fim }),
      supabase.from("clinica").select("config").eq("id", clinicaId).single(),
      supabase.from("profissional").select("id,nome").eq("clinica_id", clinicaId),
      supabase.from("servico").select("id,nome").eq("clinica_id", clinicaId),
    ]);

  const resumo = (resumoJson as unknown as ResumoDashboard) ?? null;
  const config = (clinica?.config as { dashboard?: { kpis?: unknown } } | null) ?? {};
  const kpis = kpisConfigurados(config.dashboard?.kpis);

  return (
    <RelatoriosClient
      resumo={resumo}
      kpisConfig={kpis}
      ini={ini}
      fim={fim}
      podeConfigurar={sessao.papel === "proprietario" || sessao.isAdmin}
      nomeProf={Object.fromEntries((profissionais ?? []).map((p) => [p.id, p.nome]))}
      nomeServico={Object.fromEntries((servicos ?? []).map((s) => [s.id, s.nome]))}
    />
  );
}
