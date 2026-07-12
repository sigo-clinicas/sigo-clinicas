"use client";

// Porta de reference/base44 src/components/orcamento/Odontograma.jsx.
// Componente visual puro (selecionados: string[] FDI + onChange). A
// persistência é em item_orcamento.regioes, no funil comercial (Sprint 3);
// aqui só o widget, pronto para ser plugado no ItemOrcamentoModal.
import { useState } from "react";

import { cn } from "@/lib/utils";

const DENTES_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const DENTES_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const DECIDUOS_SUPERIOR = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const DECIDUOS_INFERIOR = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

function Dente({
  numero,
  selecionado,
  onClick,
}: {
  numero: number;
  selecionado: boolean;
  onClick: (n: number) => void;
}) {
  const isMolar =
    [6, 7, 8].includes(numero % 10) ||
    [16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48].includes(numero);
  return (
    <div className="flex flex-col items-center gap-0.5 cursor-pointer group" onClick={() => onClick(numero)}>
      <span className="text-[9px] text-muted-foreground font-mono">{numero}</span>
      <div
        className={cn(
          "border-2 rounded transition-all flex items-center justify-center text-xs font-bold select-none",
          isMolar ? "w-8 h-8" : "w-6 h-8",
          selecionado
            ? "bg-blue-500 border-blue-600 text-white shadow-md scale-110"
            : "bg-white border-gray-300 text-gray-400 hover:border-blue-400 hover:bg-blue-50 group-hover:scale-105"
        )}
      >
        {selecionado && "✓"}
      </div>
    </div>
  );
}

export function Odontograma({
  selecionados = [],
  onChange,
}: {
  selecionados?: string[];
  onChange: (v: string[]) => void;
}) {
  const [deciduos, setDeciduos] = useState(false);

  function toggle(num: number) {
    const str = String(num);
    onChange(selecionados.includes(str) ? selecionados.filter((d) => d !== str) : [...selecionados, str]);
  }

  const superior = deciduos ? DECIDUOS_SUPERIOR : DENTES_SUPERIOR;
  const inferior = deciduos ? DECIDUOS_INFERIOR : DENTES_INFERIOR;
  const corte = deciduos ? 5 : 8;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Odontograma — selecione os dentes
        </span>
        <button type="button" onClick={() => setDeciduos(!deciduos)} className="text-xs text-blue-500 hover:underline">
          {deciduos ? "Ver permanentes" : "Ver decíduos"}
        </button>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 overflow-x-auto">
        <div className="flex justify-center gap-1 pb-2 border-b border-dashed border-gray-300">
          <div className="flex gap-1">
            {superior.slice(0, corte).map((n) => (
              <Dente key={n} numero={n} selecionado={selecionados.includes(String(n))} onClick={toggle} />
            ))}
          </div>
          <div className="w-4" />
          <div className="flex gap-1">
            {superior.slice(corte).map((n) => (
              <Dente key={n} numero={n} selecionado={selecionados.includes(String(n))} onClick={toggle} />
            ))}
          </div>
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground px-2 py-1">
          <span>Direito</span>
          <span>Esquerdo</span>
        </div>
        <div className="flex justify-center gap-1 pt-2 border-t border-dashed border-gray-300">
          <div className="flex gap-1">
            {inferior.slice(0, corte).map((n) => (
              <Dente key={n} numero={n} selecionado={selecionados.includes(String(n))} onClick={toggle} />
            ))}
          </div>
          <div className="w-4" />
          <div className="flex gap-1">
            {inferior.slice(corte).map((n) => (
              <Dente key={n} numero={n} selecionado={selecionados.includes(String(n))} onClick={toggle} />
            ))}
          </div>
        </div>
      </div>

      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selecionados.map((d) => (
            <span key={d} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-mono">
              Dente {d}
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
