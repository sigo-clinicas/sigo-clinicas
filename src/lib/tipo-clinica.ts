// S4-1 — White-label: ponto ÚNICO de ícone/rótulo/tema por vertical + URL do
// logo público. Consolida mapas que estavam duplicados inline (configuracoes,
// clinica-card). Isomórfico (usável em Server e Client).
import { Leaf, Smile, Sparkles, Stethoscope, type LucideIcon } from "lucide-react";

import { TERMINOLOGIA, temaDaClinica, type TipoClinica } from "@/lib/terminologia";

export { temaDaClinica };

const ICONE: Record<TipoClinica, LucideIcon> = {
  medica: Stethoscope,
  estetica: Sparkles,
  odontologica: Smile,
  terapias: Leaf,
};

/** Ícone lucide da vertical (sidebar, cards, headers). */
export function iconeDaClinica(tipo: TipoClinica): LucideIcon {
  return ICONE[tipo] ?? Stethoscope;
}

/** Rótulo do tipo de clínica (reusa TERMINOLOGIA — sem mapa duplicado). */
export function labelDaClinica(tipo: TipoClinica): string {
  return TERMINOLOGIA[tipo]?.tipoClinica ?? "Clínica";
}

/** URL pública do logo (bucket público `logos`). null se sem logo. */
export function urlLogoPublica(logoPath: string | null): string | null {
  if (!logoPath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/logos/${logoPath}` : null;
}
