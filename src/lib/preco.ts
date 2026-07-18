// S3 — rótulo de preço do serviço na vitrine pública.
//
// Reproduz a tabela de decisão do `viewPreco` do legado, corrigindo DOIS defeitos:
//  (1) "Gratuito" era DEAD CODE: o legado só chegava no ramo Gratuito depois de
//      exigir preço truthy; um serviço gratuito tem valor 0/null → caía em "Valor
//      sob consulta" e NUNCA exibia "Gratuito". Aqui decidimos pelo tipo_valor
//      ANTES de olhar o valor.
//  (2) NÃO-DETERMINISMO: o legado usava tabelaSite[0] (primeira tabela pública,
//      sem ORDER BY) → com 2+ tabelas o preço exibido dependia da ordem do banco.
//      Aqui ordenamos por (menor valor efetivo, nome da tabela).

export type TipoValorPreco = "fixo" | "a_partir_de" | "gratuito";

export type ItemPreco = {
  tipo_valor: TipoValorPreco;
  valor: number | null;
  tabela_nome: string | null;
};

const SOB_CONSULTA = "Valor sob consulta";

function brl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

// Gratuito custa 0; valor ausente (não deveria ocorrer p/ não-gratuito, mas
// defensivo) vai para o fim da fila.
function custoEfetivo(it: ItemPreco): number {
  if (it.tipo_valor === "gratuito") return 0;
  return it.valor == null ? Number.POSITIVE_INFINITY : Number(it.valor);
}

/**
 * Rótulo determinístico de preço a partir dos itens de tabela PÚBLICA de um
 * serviço (a RLS já filtrou para tabelas públicas). Item representativo = o de
 * menor custo efetivo; empate pelo nome da tabela.
 */
export function rotuloPreco(items: ItemPreco[]): string {
  if (!items || items.length === 0) return SOB_CONSULTA;

  const rep = [...items].sort(
    (a, b) =>
      custoEfetivo(a) - custoEfetivo(b) ||
      (a.tabela_nome ?? "").localeCompare(b.tabela_nome ?? "", "pt-BR")
  )[0];

  // Decide pelo tipo ANTES do valor (corrige o dead code do "Gratuito").
  if (rep.tipo_valor === "gratuito") return "Gratuito";
  if (rep.valor == null) return SOB_CONSULTA;
  if (rep.tipo_valor === "a_partir_de") return `A partir de ${brl(rep.valor)}`;
  return brl(rep.valor); // 'fixo' → só o valor, sem rótulo (paridade com o antigo)
}
