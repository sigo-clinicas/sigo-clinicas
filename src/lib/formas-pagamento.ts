// S2 — rótulos legíveis do enum public.forma_pagamento (vitrine da clínica).
// Mantém a ordem canônica do enum; ignora valores desconhecidos com segurança.

export const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao_debito: "Cartão de débito",
  cartao_credito: "Cartão de crédito",
  pix: "Pix",
  transferencia: "Transferência",
  boleto: "Boleto",
  convenio: "Convênio",
  outro: "Outros",
};

const ORDEM = Object.keys(FORMA_PAGAMENTO_LABEL);

/** Ordena pela ordem canônica do enum e mapeia para rótulos, descartando lixo. */
export function rotulosFormasPagamento(formas: string[] | null | undefined): string[] {
  if (!formas || formas.length === 0) return [];
  const set = new Set(formas);
  return ORDEM.filter((k) => set.has(k)).map((k) => FORMA_PAGAMENTO_LABEL[k]);
}
