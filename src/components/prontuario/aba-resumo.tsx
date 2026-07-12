"use client";

// Porta (parcial) de reference/base44 src/components/prontuario/
// ResumoProntuario.jsx — agregador do prontuário. No S2-2 agrega avaliações e
// documentos; evolução/anamnese/planos/galeria entram nas próximas slices.
import { Stethoscope, FileText, Activity, Pill, Camera, ShoppingBag } from "lucide-react";

import type { AvaliacaoLinha } from "./aba-avaliacao";
import type { DocumentoLinha } from "./aba-documentos";

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${a}`;
}

export function AbaResumo({
  avaliacoes,
  documentos,
  onNavigate,
}: {
  avaliacoes: AvaliacaoLinha[];
  documentos: DocumentoLinha[];
  onNavigate: (tab: string) => void;
}) {
  const totalFotos = avaliacoes.reduce(
    (s, a) => s + (Array.isArray(a.fotos) ? a.fotos.length : 0),
    0
  );

  const cards = [
    {
      tab: "avaliacao",
      label: "Avaliação Clínica",
      icon: Stethoscope,
      count: avaliacoes.length,
      preview: avaliacoes[0]
        ? `${fmtData(avaliacoes[0].data)}${avaliacoes[0].hipotese_diagnostica ? " · " + avaliacoes[0].hipotese_diagnostica : ""}`
        : "Nenhuma avaliação",
    },
    {
      tab: "documentos",
      label: "Documentos",
      icon: FileText,
      count: documentos.length,
      preview: documentos[0]
        ? `${documentos[0].titulo} (${documentos[0].status})`
        : "Nenhum documento",
    },
    { tab: "evolucao", label: "Evolução Clínica", icon: Activity, count: null, preview: "Próxima slice" },
    { tab: "receituario", label: "Receituário", icon: Pill, count: null, preview: "Próxima slice" },
    { tab: "galeria", label: "Galeria", icon: Camera, count: totalFotos, preview: `${totalFotos} foto(s)` },
    { tab: "orcamentos", label: "Planos de Tratamento", icon: ShoppingBag, count: null, preview: "Sprint 3" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((c) => (
        <button
          key={c.tab}
          onClick={() => onNavigate(c.tab)}
          className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <c.icon className="w-5 h-5 text-primary" />
            {c.count != null && (
              <span className="text-2xl font-bold">{c.count}</span>
            )}
          </div>
          <div className="font-medium text-sm">{c.label}</div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">{c.preview}</div>
        </button>
      ))}
    </div>
  );
}
