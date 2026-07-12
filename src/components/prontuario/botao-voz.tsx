"use client";

// Gancho de voz da evolução (D3 / Módulo 2 do contrato — F1). O botão de
// microfone existe e ocupa o lugar certo no fluxo, mas o ASR ainda NÃO está
// plugado: transcrição real (upload de áudio → transcricao_status/texto_bruto)
// é slice posterior. Aqui só sinalizamos o estado, sem prometer o que não faz.
import { useState } from "react";
import { Mic } from "lucide-react";

export function BotaoVoz() {
  const [aviso, setAviso] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        title="Ditar por voz"
        aria-label="Ditar por voz (em breve)"
        onClick={() => setAviso((v) => !v)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Mic className="w-4 h-4" />
      </button>
      {aviso && (
        <span className="absolute right-0 top-full mt-1 z-10 w-56 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-muted-foreground shadow-md">
          Transcrição por voz chega em breve — o microfone ainda não está
          conectado ao reconhecimento de fala.
        </span>
      )}
    </span>
  );
}
