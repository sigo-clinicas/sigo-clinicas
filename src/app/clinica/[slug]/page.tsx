import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AbaInformacoes, ClinicaShell } from "@/components/publico/clinica-detalhes";
import { clinicaPorSlug } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const dados = await clinicaPorSlug(params.slug);
  if (!dados) return { title: "Clínica não encontrada — Sigo Clínicas" };
  const { clinica } = dados;
  return {
    title: `SigoClínicas - ${clinica.nome}`,
    description:
      clinica.sobre ??
      `${clinica.nome}${clinica.cidade ? ` em ${clinica.cidade}` : ""} — agende online.`,
  };
}

// Página pública da clínica (A7) — reskin do DetalhesComponent antigo, aba
// "Informações". Só dados públicos (marketplace + RLS). As demais abas são
// sub-rotas irmãs. O agendamento vive em /agendar (S3-8, funcional).
export default async function ClinicaPage({ params }: { params: { slug: string } }) {
  const dados = await clinicaPorSlug(params.slug);
  if (!dados) notFound();

  return (
    <ClinicaShell nome={dados.clinica.nome} slug={params.slug} aba="informacoes">
      <AbaInformacoes dados={dados} />
    </ClinicaShell>
  );
}
