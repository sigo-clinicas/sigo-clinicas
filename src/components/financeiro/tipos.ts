// S3-3 — tipos/labels compartilhados do financeiro (UI).

export type TipoLancamento = "receita" | "despesa";
export type StatusLancamento =
  | "pendente"
  | "pago_parcial"
  | "pago"
  | "cancelado"
  | "atrasado";
export type TipoConta =
  | "conta_corrente"
  | "cartao_credito"
  | "comissao"
  | "caixa"
  | "outro";

export type ContaRow = {
  id: string;
  nome: string;
  tipo: TipoConta;
  banco: string | null;
  agencia: string | null;
  numero_conta: string | null;
  saldo_inicial: number;
  ativo: boolean;
  saldo_atual: number;
};

export type CategoriaRow = {
  id: string;
  nome: string;
  tipo: TipoLancamento;
  descricao: string | null;
  pai_id: string | null;
  ordem: number;
  ativo: boolean;
};

export type CentroCustoRow = {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  ativo: boolean;
};

export type LancamentoRow = {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  valor_pago: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: StatusLancamento;
  categoria_id: string | null;
  centro_custo_id: string | null;
  forma_pagamento: string | null;
  paciente_id: string | null;
  venda_id: string | null;
  observacoes: string | null;
};

export type OpcaoSimples = { id: string; nome: string };

export const STATUS_LANCAMENTO: Record<StatusLancamento, { label: string; cor: string }> = {
  pendente: { label: "Pendente", cor: "bg-gray-100 text-gray-700" },
  pago_parcial: { label: "Parcial", cor: "bg-amber-100 text-amber-700" },
  pago: { label: "Pago", cor: "bg-green-100 text-green-700" },
  cancelado: { label: "Cancelado", cor: "bg-red-100 text-red-700" },
  atrasado: { label: "Atrasado", cor: "bg-red-100 text-red-700" },
};

export const TIPO_CONTA_LABEL: Record<TipoConta, string> = {
  conta_corrente: "Conta corrente",
  cartao_credito: "Cartão de crédito",
  comissao: "Comissão",
  caixa: "Caixa",
  outro: "Outro",
};

export const FORMAS_PAGAMENTO: { valor: string; label: string }[] = [
  { valor: "dinheiro", label: "Dinheiro" },
  { valor: "pix", label: "Pix" },
  { valor: "cartao_credito", label: "Cartão de crédito" },
  { valor: "cartao_debito", label: "Cartão de débito" },
  { valor: "boleto", label: "Boleto" },
  { valor: "transferencia", label: "Transferência" },
  { valor: "convenio", label: "Convênio" },
  { valor: "outro", label: "Outro" },
];

export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

export function emAberto(l: LancamentoRow): number {
  return Math.max(0, Number(l.valor) - Number(l.valor_pago));
}
