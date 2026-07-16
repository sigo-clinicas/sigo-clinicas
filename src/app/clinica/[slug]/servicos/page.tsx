import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AbaServicos, ClinicaShell } from "@/components/publico/clinica-detalhes";
import { clinicaPorSlug } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const dados = await clinicaPorSlug(params.slug);
  return {
    title: dados ? `SigoClínicas - ${dados.clinica.nome} - Serviços` : "Clínica não encontrada",
  };
}

// Aba "Serviços" da página da clínica (sub-rota irmã de /clinica/[slug]).
export default async function ServicosPage({ params }: { params: { slug: string } }) {
  const dados = await clinicaPorSlug(params.slug);
  if (!dados) notFound();

  return (
    <ClinicaShell nome={dados.clinica.nome} slug={params.slug} aba="servicos">
      <AbaServicos dados={dados} slug={params.slug} />
    </ClinicaShell>
  );
}
