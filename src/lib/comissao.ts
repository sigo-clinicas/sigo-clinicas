// S3-5 — Cálculo de comissão (módulo puro, testável). Porta da regra do Base44
// Comissoes.jsx: percentual sobre a base, ou valor fixo.

export type TipoComissao = "percentual" | "valor_fixo";

/** Valor da comissão de uma linha: percentual sobre `base` ou valor fixo. */
export function calcularComissao(
  tipo: TipoComissao,
  valorComissao: number,
  base: number
): number {
  const v =
    tipo === "percentual"
      ? (Number(base) || 0) * ((Number(valorComissao) || 0) / 100)
      : Number(valorComissao) || 0;
  return Math.round(v * 100) / 100;
}

/** Intervalo [início, fim) do mês de competência (YYYY-MM) em ISO. */
export function intervaloCompetencia(competencia: string): {
  inicio: string;
  fim: string;
  primeiroDia: string;
  ultimoDia: string;
} {
  const [ano, mes] = competencia.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 1));
  const ultimo = new Date(Date.UTC(ano, mes, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    primeiroDia: iso(inicio),
    ultimoDia: iso(ultimo),
  };
}
