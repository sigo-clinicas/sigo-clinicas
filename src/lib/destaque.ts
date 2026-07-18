// S7 — marcação (selo) de destaque na landing. O `nivel` é RÓTULO comercial
// (parceiro/premium); NÃO afeta a ordenação nem carrega regra de cobrança — o
// modelo de monetização é decisão pendente da cliente (CLAUDE.md §9.1). Aqui só
// a ESTRUTURA: quem é destaque e como aparece.

export type NivelDestaque = "neutro" | "parceiro" | "premium";

const ROTULO: Record<string, string> = {
  parceiro: "Parceiro",
  premium: "Premium",
};

/** Rótulo do selo, ou null quando não há destaque a exibir (neutro/desconhecido). */
export function rotuloNivel(nivel: string | null | undefined): string | null {
  if (!nivel) return null;
  return ROTULO[nivel] ?? null;
}

/** Destaque dentro da vigência? (datas em ISO 'YYYY-MM-DD' ou null = sem limite). */
export function destaqueVigente(
  hoje: string,
  vigencia_inicio: string | null,
  vigencia_fim: string | null
): boolean {
  if (vigencia_inicio && hoje < vigencia_inicio) return false;
  if (vigencia_fim && hoje > vigencia_fim) return false;
  return true;
}
