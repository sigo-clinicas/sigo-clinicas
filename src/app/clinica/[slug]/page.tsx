import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, Star, Stethoscope } from "@/components/lucide-icons";

import { Button } from "@/components/ui/button";
import { TIPO_CLINICA_LABEL } from "@/components/marketplace/clinica-card";
import { clinicaPorSlug } from "@/lib/marketplace";
import { temaDaClinica, urlLogoPublica } from "@/lib/tipo-clinica";
import type { TipoClinica } from "@/lib/terminologia";

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

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
    title: `${clinica.nome} — Sigo Clínicas`,
    description:
      clinica.sobre ??
      `${clinica.nome}${clinica.cidade ? ` em ${clinica.cidade}` : ""} — agende online.`,
  };
}

// Página pública da clínica (A7). Só dados públicos (serviços/profissionais/
// depoimentos via *_select_marketplace). Agendamento no S3-8.
export default async function ClinicaPage({ params }: { params: { slug: string } }) {
  const dados = await clinicaPorSlug(params.slug);
  if (!dados) notFound();
  const { clinica, servicos, profissionais, depoimentos } = dados;
  const local = [clinica.bairro, clinica.cidade, clinica.uf].filter(Boolean).join(", ");
  const logo = urlLogoPublica(clinica.logo_path);
  const tema = clinica.tipo ? temaDaClinica(clinica.tipo as TipoClinica) : undefined;

  return (
    <main data-clinica-theme={tema} className="mx-auto min-h-screen max-w-4xl px-4 py-8">
      <Link href="/buscar" className="text-muted-foreground text-sm hover:underline">
        ← Buscar
      </Link>

      {/* Cabeçalho */}
      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="bg-primary/10 text-primary flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl text-2xl font-semibold">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={clinica.nome} className="h-full w-full object-cover" />
            ) : (
              clinica.nome.charAt(0).toUpperCase()
            )}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{clinica.nome}</h1>
            <p className="text-muted-foreground text-sm">
              {clinica.tipo ? TIPO_CLINICA_LABEL[clinica.tipo] ?? clinica.tipo : ""}
            </p>
            {local && (
              <p className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                <MapPin className="h-3.5 w-3.5" /> {local}
              </p>
            )}
          </div>
        </div>
        {clinica.slug && (
          <Button asChild size="lg">
            <Link href={`/clinica/${clinica.slug}/agendar`}>Agendar</Link>
          </Button>
        )}
      </header>

      {clinica.sobre && (
        <section className="mt-6">
          <p className="text-muted-foreground">{clinica.sobre}</p>
        </section>
      )}

      {/* Serviços */}
      {servicos.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Serviços</h2>
          <div className="divide-y divide-border rounded-xl border border-border">
            {servicos.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{s.nome}</p>
                  {s.descricao && (
                    <p className="text-muted-foreground text-sm">{s.descricao}</p>
                  )}
                  {s.duracao_minutos && (
                    <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" /> {s.duracao_minutos} min
                    </p>
                  )}
                </div>
                {s.preco != null && (
                  <span className="whitespace-nowrap font-semibold">{brl(s.preco)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Profissionais */}
      {profissionais.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Profissionais</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {profissionais.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                <span className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                  <Stethoscope className="text-muted-foreground h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium">{p.nome}</p>
                  {p.nome_conselho && p.numero_registro && (
                    <p className="text-muted-foreground text-xs">
                      {p.nome_conselho} {p.numero_registro}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Depoimentos */}
      {depoimentos.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Avaliações</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {depoimentos.map((d) => (
              <div key={d.id} className="rounded-xl border border-border bg-card p-4">
                {d.nota != null && (
                  <div className="mb-1 flex gap-0.5 text-amber-500">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className="h-3.5 w-3.5"
                        fill={i < d.nota! ? "currentColor" : "none"}
                      />
                    ))}
                  </div>
                )}
                <p className="text-sm">{d.texto}</p>
                <p className="text-muted-foreground mt-2 text-xs">— {d.paciente_nome}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-center">
        <h2 className="text-lg font-semibold">Pronto para agendar?</h2>
        {clinica.slug && (
          <Button asChild className="mt-3">
            <Link href={`/clinica/${clinica.slug}/agendar`}>Agendar online</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
