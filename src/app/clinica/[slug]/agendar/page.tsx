import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { clinicaPorSlug } from "@/lib/marketplace";
import { PublicShell } from "@/components/publico/public-shell";
import estilos from "@/components/publico/detalhes.module.css";

import { AgendarClient } from "./agendar-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agendar — Sigo Clínicas",
  robots: { index: false, follow: true }, // fluxo de conversão, não precisa indexar
};

// S3-8 / S6 — Agendamento público escopado à clínica. Os slots são calculados no
// servidor (service_role) via Server Action `carregarSlots`, recalculados quando
// o usuário troca de profissional ou de serviços (passo = duração somada, no fuso
// da clínica).
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

  // Reskin: só a moldura (PublicShell + banner) muda; o miolo funcional fica.
  return (
    <PublicShell inside>
      <header className={estilos.header}>
        <h1 className="clinic-name">Agende seu horário</h1>
      </header>
      <AgendarClient
        clinicaId={dados.clinica.id}
        clinicaNome={dados.clinica.nome}
        slug={params.slug}
        timezone={dados.clinica.timezone}
        profissionais={profissionais.map((p) => ({ id: p.id, nome: p.nome }))}
        servicos={dados.servicos.map((s) => ({ id: s.id, nome: s.nome }))}
        vinculos={dados.vinculos}
        profSelecionado={profSelecionado}
      />
    </PublicShell>
  );
}
