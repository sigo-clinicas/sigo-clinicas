import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ClinicaCard } from "@/components/marketplace/clinica-card";
import { clinicasDestaque } from "@/lib/marketplace";

// SSR dinâmico (lê sessão/cookies via createClient). Indexável (sem noindex).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sigo Clínicas — encontre e agende na clínica ideal",
  description:
    "Marketplace de clínicas médicas, estéticas, odontológicas e de terapias. Busque por cidade e especialidade e agende online.",
};

// A7 — marketplace multi-clínica público (referência funcional: legado www;
// visual: Base44 LandingPage). Página indexável (SSR), sem noindex.
export default async function Home() {
  const destaques = await clinicasDestaque(6);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="from-primary/10 bg-gradient-to-b to-transparent px-4 py-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Sua saúde e bem-estar, com a clínica certa
          </h1>
          <p className="text-muted-foreground mt-4 text-lg">
            Encontre clínicas médicas, estéticas, odontológicas e de terapias
            perto de você e agende online.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/buscar">
                <Search className="mr-2 h-4 w-4" /> Buscar clínicas
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sou uma clínica</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Clínicas em destaque */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Clínicas em destaque</h2>
          <Link href="/buscar" className="text-primary text-sm hover:underline">
            Ver todas →
          </Link>
        </div>
        {destaques.length === 0 ? (
          <p className="text-muted-foreground">
            Em breve, clínicas parceiras aparecerão aqui.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {destaques.map((c) => (
              <ClinicaCard key={c.id} clinica={c} />
            ))}
          </div>
        )}
      </section>

      {/* Como funciona */}
      <section className="bg-muted/30 px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-2xl font-semibold">Como funciona</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { t: "Busque", d: "Filtre por cidade e especialidade." },
              { t: "Escolha", d: "Veja serviços, profissionais e avaliações." },
              { t: "Agende", d: "Marque online, sem cadastro complicado." },
            ].map((p, i) => (
              <div key={p.t} className="text-center">
                <span className="bg-primary text-primary-foreground mx-auto flex h-10 w-10 items-center justify-center rounded-full font-semibold">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-medium">{p.t}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center">
        <p className="text-muted-foreground text-sm">
          © 2026 Sigo Clínicas ·{" "}
          <Link href="/login" className="hover:underline">
            Área da clínica
          </Link>
        </p>
      </footer>
    </main>
  );
}
