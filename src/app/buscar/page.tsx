import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { ClinicaCard } from "@/components/marketplace/clinica-card";
import {
  listarCidades,
  listarClinicas,
  listarEspecialidades,
} from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buscar clínicas — Sigo Clínicas",
  description: "Busque clínicas por cidade e especialidade e agende online.",
};

// Busca pública (A7): filtro por cidade + especialidade. Form nativo (GET) →
// funciona sem JS (SEO). Resultado ordenado por marketplace_ranking_score.
export default async function BuscarPage({
  searchParams,
}: {
  searchParams: { cidade?: string; especialidade?: string };
}) {
  const cidade = searchParams.cidade ?? "";
  const especialidade = searchParams.especialidade ?? "";

  const [clinicas, cidades, especialidades] = await Promise.all([
    listarClinicas({
      cidade: cidade || undefined,
      especialidade: especialidade || undefined,
    }),
    listarCidades(),
    listarEspecialidades(),
  ]);

  // agrupa especialidades por segmento
  const porSegmento = new Map<string, typeof especialidades>();
  for (const e of especialidades) {
    const k = e.segmento ?? "Outras";
    porSegmento.set(k, [...(porSegmento.get(k) ?? []), e]);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <Link href="/" className="text-muted-foreground text-sm hover:underline">
        ← Início
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Buscar clínicas</h1>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex-1 space-y-1.5 min-w-[180px]">
          <span className="text-muted-foreground text-xs">Cidade</span>
          <select
            name="cidade"
            defaultValue={cidade}
            className="border-border bg-background h-10 w-full rounded-md border px-3 text-sm"
          >
            <option value="">Todas as cidades</option>
            {cidades.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 space-y-1.5 min-w-[180px]">
          <span className="text-muted-foreground text-xs">Especialidade</span>
          <select
            name="especialidade"
            defaultValue={especialidade}
            className="border-border bg-background h-10 w-full rounded-md border px-3 text-sm"
          >
            <option value="">Todas as especialidades</option>
            {[...porSegmento.entries()].map(([seg, lista]) => (
              <optgroup key={seg} label={seg}>
                {lista.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium"
        >
          <Search className="h-4 w-4" /> Buscar
        </button>
      </form>

      <p className="text-muted-foreground mt-6 text-sm">
        {clinicas.length} clínica(s) encontrada(s)
      </p>
      {clinicas.length === 0 ? (
        <p className="text-muted-foreground mt-4">
          Nenhuma clínica para os filtros escolhidos.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clinicas.map((c) => (
            <ClinicaCard key={c.id} clinica={c} />
          ))}
        </div>
      )}
    </main>
  );
}
