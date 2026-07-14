// S3-1 — tipos compartilhados do funil comercial (UI). Fonte de verdade dos
// dados persistidos é o schema comercial (0600) + deltas S3-1.

export type StatusOrcamento =
  | "rascunho"
  | "enviado"
  | "aprovado"
  | "recusado"
  | "expirado";

export type TipoValor = "fixo" | "a_partir_de" | "gratuito";

export type OpcaoProfissional = { id: string; nome: string };
export type OpcaoConvenio = { id: string; nome: string };
export type OpcaoPaciente = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  convenio_id: string | null;
};
export type OpcaoServico = { id: string; nome: string };
export type TabelaPreco = { id: string; nome: string; convenio_id: string | null };
export type ItemTabela = {
  tabela_preco_id: string;
  servico_id: string;
  tipo_valor: TipoValor;
  valor: number;
};
export type ProdutoEstoque = {
  id: string;
  descricao: string;
  unidade: string | null;
  preco_venda: number | null;
  preco_custo: number | null;
  saldo: number;
};

// Linha do formulário (antes de persistir). `nome` é só rótulo de exibição.
export type ItemFormulario = {
  servico_id: string | null;
  item_estoque_id: string | null;
  nome: string;
  quantidade: number;
  valor_unitario: number;
  tipo_valor: TipoValor;
  regioes: string[];
  unidade: string | null;
  observacao: string | null;
};

export type ItemOrcamentoRow = {
  id: string;
  orcamento_id: string;
  servico_id: string | null;
  item_estoque_id: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  tipo_valor: TipoValor;
  regioes: string[];
  unidade: string | null;
  observacao: string | null;
};

export type OrcamentoRow = {
  id: string;
  paciente_id: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  profissional_id: string | null;
  convenio_id: string | null;
  tabela_preco_id: string | null;
  status: StatusOrcamento;
  validade_dias: number;
  valor_total: number;
  tipo_desconto: "percentual" | "valor";
  desconto: number;
  valor_final: number;
  observacoes: string | null;
  anotacoes_internas: string | null;
  created_at: string;
  itens: ItemOrcamentoRow[];
};

export const STATUS_ORCAMENTO: { valor: StatusOrcamento; label: string; cor: string }[] = [
  { valor: "rascunho", label: "Rascunho", cor: "bg-gray-100 text-gray-700" },
  { valor: "enviado", label: "Enviado", cor: "bg-blue-100 text-blue-700" },
  { valor: "aprovado", label: "Aprovado", cor: "bg-green-100 text-green-700" },
  { valor: "recusado", label: "Recusado", cor: "bg-red-100 text-red-700" },
  { valor: "expirado", label: "Expirado", cor: "bg-amber-100 text-amber-700" },
];

export const TIPO_VALOR_LABEL: Record<TipoValor, string> = {
  fixo: "Valor fixo",
  a_partir_de: "A partir de",
  gratuito: "Gratuito",
};

export const FORMAS_PAGAMENTO: { valor: string; label: string }[] = [
  { valor: "dinheiro", label: "Dinheiro" },
  { valor: "pix", label: "Pix" },
  { valor: "cartao_credito", label: "Cartão de crédito" },
  { valor: "cartao_debito", label: "Cartão de débito" },
  { valor: "boleto", label: "Boleto" },
  { valor: "transferencia", label: "Transferência" },
];

export type VendaRow = {
  id: string;
  orcamento_id: string;
  data_hora: string;
  forma_pagamento: string | null;
  cancelada: boolean;
};

export type PagamentoRow = {
  id: string;
  venda_id: string;
  numero_parcela: number;
  valor: number;
  vencimento: string;
  pago: boolean;
  data_pagamento: string | null;
};

export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

// Totais — MESMA fórmula da RPC salvar_orcamento (exibição espelha o servidor).
export function calcularTotais(
  itens: { quantidade: number; valor_unitario: number; tipo_valor: TipoValor }[],
  tipoDesconto: "percentual" | "valor",
  desconto: number
) {
  const valorTotal = itens.reduce(
    (acc, i) =>
      acc +
      (i.tipo_valor === "gratuito"
        ? 0
        : Math.round(Number(i.quantidade) * Number(i.valor_unitario) * 100) / 100),
    0
  );
  const descontoAplicado =
    tipoDesconto === "percentual"
      ? (valorTotal * (Number(desconto) || 0)) / 100
      : Number(desconto) || 0;
  const valorFinal = Math.max(0, Math.round((valorTotal - descontoAplicado) * 100) / 100);
  return { valorTotal, descontoAplicado, valorFinal };
}
