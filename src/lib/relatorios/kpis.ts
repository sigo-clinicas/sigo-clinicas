// S4-4 — Registro CONFIGURÁVEL de KPIs (ponto único de extensão). A lista final
// de KPIs é decisão da cliente; aqui um default sensato + registro fácil de
// estender/reordenar (clinica.config.dashboard.kpis = [ids...] em ordem).

export type ResumoDashboard = {
  faturamento_recebido: number;
  despesas_pagas: number;
  a_receber: number;
  a_pagar: number;
  consultas_total: number;
  consultas_concluidas: number;
  consultas_faltou: number;
  consultas_retorno: number;
  pacientes_unicos: number;
  por_profissional: { profissional_id: string; qtd: number }[];
  servicos_mais_vendidos: { servico_id: string; qtd: number }[];
};

export type KpiId =
  | "faturamento_recebido"
  | "despesas_pagas"
  | "lucro"
  | "a_receber"
  | "a_pagar"
  | "consultas_total"
  | "consultas_concluidas"
  | "taxa_comparecimento"
  | "ticket_medio"
  | "pacientes_unicos"
  | "retorno";

export type Formato = "moeda" | "numero" | "percent";
export type KpiDef = {
  id: KpiId;
  label: string;
  categoria: "financeiro" | "produtividade";
  formato: Formato;
  valor: (r: ResumoDashboard) => number;
};

/** Taxa de comparecimento = concluídas / (concluídas + faltas). */
export function taxaComparecimento(concluidas: number, faltou: number): number {
  const base = concluidas + faltou;
  return base > 0 ? (concluidas / base) * 100 : 0;
}

/** Ticket médio = faturamento recebido / consultas concluídas. */
export function ticketMedio(faturamento: number, concluidas: number): number {
  return concluidas > 0 ? faturamento / concluidas : 0;
}

export const KPIS: Record<KpiId, KpiDef> = {
  faturamento_recebido: { id: "faturamento_recebido", label: "Faturamento recebido", categoria: "financeiro", formato: "moeda", valor: (r) => r.faturamento_recebido },
  despesas_pagas: { id: "despesas_pagas", label: "Despesas pagas", categoria: "financeiro", formato: "moeda", valor: (r) => r.despesas_pagas },
  lucro: { id: "lucro", label: "Resultado (caixa)", categoria: "financeiro", formato: "moeda", valor: (r) => r.faturamento_recebido - r.despesas_pagas },
  a_receber: { id: "a_receber", label: "A receber", categoria: "financeiro", formato: "moeda", valor: (r) => r.a_receber },
  a_pagar: { id: "a_pagar", label: "A pagar", categoria: "financeiro", formato: "moeda", valor: (r) => r.a_pagar },
  consultas_total: { id: "consultas_total", label: "Agendamentos", categoria: "produtividade", formato: "numero", valor: (r) => r.consultas_total },
  consultas_concluidas: { id: "consultas_concluidas", label: "Concluídas", categoria: "produtividade", formato: "numero", valor: (r) => r.consultas_concluidas },
  taxa_comparecimento: { id: "taxa_comparecimento", label: "Comparecimento", categoria: "produtividade", formato: "percent", valor: (r) => taxaComparecimento(r.consultas_concluidas, r.consultas_faltou) },
  ticket_medio: { id: "ticket_medio", label: "Ticket médio", categoria: "financeiro", formato: "moeda", valor: (r) => ticketMedio(r.faturamento_recebido, r.consultas_concluidas) },
  pacientes_unicos: { id: "pacientes_unicos", label: "Pacientes únicos", categoria: "produtividade", formato: "numero", valor: (r) => r.pacientes_unicos },
  retorno: { id: "retorno", label: "Retornos", categoria: "produtividade", formato: "numero", valor: (r) => r.consultas_retorno },
};

/** KPIs default (ordem = ordem de render). Reordenar = reescrever este array em config. */
export const DEFAULT_DASHBOARD: KpiId[] = [
  "faturamento_recebido",
  "a_receber",
  "consultas_total",
  "taxa_comparecimento",
  "ticket_medio",
  "pacientes_unicos",
];

export function kpisConfigurados(ids: unknown): KpiId[] {
  const validos = Array.isArray(ids)
    ? ids.filter((x): x is KpiId => typeof x === "string" && x in KPIS)
    : [];
  return validos.length > 0 ? validos : DEFAULT_DASHBOARD;
}

export function formatarKpi(valor: number, formato: Formato): string {
  if (formato === "moeda")
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
  if (formato === "percent") return `${(valor || 0).toFixed(0)}%`;
  return String(Math.round(valor || 0));
}
