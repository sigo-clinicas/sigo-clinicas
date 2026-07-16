import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { clinicaPorSlug } from "@/lib/marketplace";
import { slotsDisponiveis } from "@/lib/agenda-publica";
import { PublicShell } from "@/components/publico/public-shell";
import estilos from "@/components/publico/detalhes.module.css";

import { AgendarClient } from "./agendar-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agendar — Sigo Clínicas",
  robots: { index: false, follow: true }, // fluxo de conversão, não precisa indexar
};

// S3-8 — Agendamento público escopado à clínica (porta Base44 PortalAgendamento,
// agora multi-clínica). Slots calculados no servidor (service_role).
export default async function AgendarPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { prof?: string };
}) {
  const dados = await clinicaPorSlug(params.slug);
  if (!dados) notFound();

  const profissionais = dados.profissionais;
  const profSelecionado =
    (searchParams.prof && profissionais.find((p) => p.id === searchParams.prof)?.id) ??
    profissionais[0]?.id ??
    null;

  const slots = profSelecionado
    ? await slotsDisponiveis(dados.clinica.id, profSelecionado)
    : [];

  // Reskin: só a moldura (PublicShell + banner) muda; o miolo funcional do
  // AgendarClient (slots, form de lead, POST /api/publico/agendamento) fica
  // intacto — decisão da liderança. Sem data-clinica-theme: cores fixas do tema
  // padrão (teal ≈ #00ba9e do antigo), coerente com o mono-marca do site antigo.
  return (
    <PublicShell inside>
      <header className={estilos.header}>
        <h1 className="clinic-name">Agende seu horário</h1>
      </header>
      <AgendarClient
        clinicaId={dados.clinica.id}
        clinicaNome={dados.clinica.nome}
        slug={params.slug}
        profissionais={profissionais.map((p) => ({ id: p.id, nome: p.nome }))}
        servicos={dados.servicos.map((s) => ({ id: s.id, nome: s.nome }))}
        profSelecionado={profSelecionado}
        slots={slots}
      />
    </PublicShell>
  );
}
