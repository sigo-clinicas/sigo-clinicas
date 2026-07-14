"use client";

// S4-1 — Context de terminologia por vertical (substitui o prop-drilling do
// `termo`). Componentes profundos do painel usam useTermo() para alcançar a
// nomenclatura correta (Cliente/Paciente, Atendimento/Consulta, etc.).
import { createContext, useContext, type ReactNode } from "react";

import type { Terminologia } from "@/lib/terminologia";

const TermoContext = createContext<Terminologia | null>(null);

export function TermoProvider({
  termo,
  children,
}: {
  termo: Terminologia;
  children: ReactNode;
}) {
  return <TermoContext.Provider value={termo}>{children}</TermoContext.Provider>;
}

export function useTermo(): Terminologia {
  const ctx = useContext(TermoContext);
  if (!ctx) {
    throw new Error("useTermo() precisa estar dentro de <TermoProvider>.");
  }
  return ctx;
}
