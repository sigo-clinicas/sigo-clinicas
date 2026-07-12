"use client";

// Porta de reference/base44 src/components/orcamento/MapaEstetica.jsx.
// O Base44 importava mas NÃO religava este componente — aqui ele é portado e
// fica pronto para ser plugado no ItemOrcamentoModal (Sprint 3, para clínicas
// tipo 'estetica'). Persistência em item_orcamento.regioes.
import { cn } from "@/lib/utils";

const REGIOES_FACE = [
  { id: "fronte", label: "Fronte", x: 38, y: 4, w: 24 },
  { id: "olho_direito", label: "Olho D", x: 22, y: 18, w: 16 },
  { id: "olho_esquerdo", label: "Olho E", x: 62, y: 18, w: 16 },
  { id: "nariz", label: "Nariz", x: 38, y: 28, w: 24 },
  { id: "bochecha_direita", label: "Boch. D", x: 12, y: 32, w: 18 },
  { id: "bochecha_esquerda", label: "Boch. E", x: 70, y: 32, w: 18 },
  { id: "labios", label: "Lábios", x: 34, y: 44, w: 32 },
  { id: "mento", label: "Mento", x: 36, y: 56, w: 28 },
  { id: "pescoco", label: "Pescoço", x: 34, y: 67, w: 32 },
];

const REGIOES_CORPO = [
  { id: "cabeca", label: "Cabeça" },
  { id: "pescoco_c", label: "Pescoço" },
  { id: "ombros", label: "Ombros" },
  { id: "peito", label: "Peito/Busto" },
  { id: "abdomen", label: "Abdômen" },
  { id: "flancos", label: "Flancos" },
  { id: "costas_sup", label: "Costas Sup." },
  { id: "costas_inf", label: "Costas Inf." },
  { id: "gluteos", label: "Glúteos" },
  { id: "bracos", label: "Braços" },
  { id: "coxas", label: "Coxas" },
  { id: "pernas", label: "Pernas" },
  { id: "joelhos", label: "Joelhos" },
  { id: "pes", label: "Pés" },
];

const TODAS = [...REGIOES_FACE, ...REGIOES_CORPO];

export function MapaEstetica({
  selecionados = [],
  onChange,
}: {
  selecionados?: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selecionados.includes(id) ? selecionados.filter((r) => r !== id) : [...selecionados, id]);
  }

  return (
    <div className="space-y-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Regiões tratadas — clique para selecionar
      </span>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-center text-muted-foreground">Rosto</p>
          <div
            className="relative bg-gradient-to-b from-amber-50 to-amber-100 rounded-xl border border-amber-200 overflow-hidden"
            style={{ paddingBottom: "85%" }}
          >
            <svg viewBox="0 0 100 85" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="50" cy="38" rx="28" ry="36" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6" />
              <rect x="42" y="72" width="16" height="12" rx="4" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6" />
            </svg>
            {REGIOES_FACE.map((r) => (
              <div
                key={r.id}
                className="absolute cursor-pointer"
                style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%` }}
                onClick={() => toggle(r.id)}
              >
                <div
                  className={cn(
                    "rounded text-center text-[9px] font-medium py-0.5 border transition-all select-none",
                    selecionados.includes(r.id)
                      ? "bg-pink-400 border-pink-500 text-white shadow scale-105"
                      : "bg-white/70 border-pink-200 text-pink-700 hover:bg-pink-100"
                  )}
                >
                  {r.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-center text-muted-foreground">Corpo</p>
          <div className="grid grid-cols-2 gap-1">
            {REGIOES_CORPO.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                className={cn(
                  "text-xs px-2 py-1.5 rounded border transition-all font-medium",
                  selecionados.includes(r.id)
                    ? "bg-pink-400 border-pink-500 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-pink-300 hover:bg-pink-50"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selecionados.map((id) => (
            <span key={id} className="bg-pink-100 text-pink-700 text-xs px-2 py-0.5 rounded-full">
              {TODAS.find((r) => r.id === id)?.label || id}
            </span>
          ))}
          <button type="button" onClick={() => onChange([])} className="text-xs text-red-400 hover:underline ml-1">
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}
