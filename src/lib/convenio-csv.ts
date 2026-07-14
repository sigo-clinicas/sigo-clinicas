// S4-5 — Conciliação de guias de convênio a partir do CSV que a operadora
// devolve (guias pagas/glosadas/parciais). Módulo PURO: só parsing + matching,
// sem I/O. O gate financeiro (a baixa que mexe em dinheiro) mora na RPC
// transacional registrar_baixa_lote_convenio; aqui só decidimos o que baixar.
// Testável isoladamente (tests/unit/convenio-csv.test.ts).

export type LinhaGuiaCsv = {
  numero_guia: string;
  valor_pago: number;
};

/** Conta a receber já gerada (gerar_recebiveis_convenio) que buscamos casar. */
export type AtendimentoConvenio = {
  lancamento_id: string;
  numero_guia: string | null;
  valor_devido: number; // saldo em aberto do lançamento (valor - valor_pago)
};

export type SituacaoGuia =
  | "paga" // convênio pagou o valor devido
  | "divergente" // pagou, mas ≠ do devido (glosa parcial / a maior)
  | "glosada" // veio no retorno com valor 0
  | "sem_retorno" // atendimento sem linha no CSV
  | "nao_reconhecida"; // linha no CSV sem atendimento correspondente

export type GuiaConciliada = {
  numero_guia: string;
  lancamento_id: string | null;
  valor_devido: number | null;
  valor_pago: number;
  situacao: SituacaoGuia;
};

const TOLERANCIA = 0.01;

/** Converte "R$ 1.234,56", "1234.56", "1.234", "" em número (0 se inválido). */
export function parseValorBR(bruto: string): number {
  let s = (bruto ?? "").trim().replace(/r\$/i, "").replace(/\s/g, "");
  if (s === "") return 0;
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    // formato BR: ponto de milhar, vírgula decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    s = s.replace(",", ".");
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lê o CSV bruto. Detecta o delimitador (`;` — padrão BR — ou `,`), pula
 * cabeçalho quando presente (linha que menciona "guia") e cai para col0=guia,
 * col1=valor quando não há cabeçalho. Linhas sem número de guia são ignoradas.
 */
export function parseCsvGuias(texto: string): LinhaGuiaCsv[] {
  const linhas = (texto ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (linhas.length === 0) return [];

  const delim = (linhas[0].match(/;/g)?.length ?? 0) >= (linhas[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  let idxGuia = 0;
  let idxValor = 1;
  let inicio = 0;
  const primeira = linhas[0].toLowerCase();
  if (primeira.includes("guia") || primeira.includes("valor")) {
    const cols = linhas[0].split(delim).map((c) => c.trim().toLowerCase());
    const g = cols.findIndex((c) => c.includes("guia"));
    const v = cols.findIndex((c) => c.includes("valor") || c.includes("pago"));
    if (g >= 0) idxGuia = g;
    if (v >= 0) idxValor = v;
    inicio = 1;
  }

  const out: LinhaGuiaCsv[] = [];
  for (let i = inicio; i < linhas.length; i++) {
    const cols = linhas[i].split(delim);
    const numero_guia = (cols[idxGuia] ?? "").trim();
    if (numero_guia === "") continue;
    out.push({ numero_guia, valor_pago: parseValorBR(cols[idxValor] ?? "") });
  }
  return out;
}

/**
 * Casa as linhas do CSV com os atendimentos (por número de guia) e classifica
 * cada guia. Atendimentos sem linha no CSV entram como `sem_retorno`.
 */
export function conciliarGuias(
  atendimentos: AtendimentoConvenio[],
  linhas: LinhaGuiaCsv[]
): GuiaConciliada[] {
  const porGuia = new Map<string, AtendimentoConvenio>();
  for (const a of atendimentos) {
    const g = (a.numero_guia ?? "").trim();
    if (g !== "") porGuia.set(g, a);
  }

  const usados = new Set<string>();
  const out: GuiaConciliada[] = [];

  for (const linha of linhas) {
    const guia = linha.numero_guia.trim();
    const at = porGuia.get(guia);
    if (!at) {
      out.push({
        numero_guia: guia,
        lancamento_id: null,
        valor_devido: null,
        valor_pago: linha.valor_pago,
        situacao: "nao_reconhecida",
      });
      continue;
    }
    usados.add(guia);
    let situacao: SituacaoGuia;
    if (linha.valor_pago <= 0) situacao = "glosada";
    else if (Math.abs(linha.valor_pago - at.valor_devido) <= TOLERANCIA) situacao = "paga";
    else situacao = "divergente";
    out.push({
      numero_guia: guia,
      lancamento_id: at.lancamento_id,
      valor_devido: at.valor_devido,
      valor_pago: linha.valor_pago,
      situacao,
    });
  }

  // atendimentos que a operadora não devolveu
  for (const a of atendimentos) {
    const g = (a.numero_guia ?? "").trim();
    if (g === "" || usados.has(g)) continue;
    out.push({
      numero_guia: g,
      lancamento_id: a.lancamento_id,
      valor_devido: a.valor_devido,
      valor_pago: 0,
      situacao: "sem_retorno",
    });
  }

  return out;
}

/**
 * Itens prontos para registrar_baixa_lote_convenio: só guias pagas/divergentes
 * com lançamento e valor > 0. Baixa o MENOR entre pago e devido (o excedente,
 * se o convênio pagou a maior, não vira crédito fantasma — fica de fora).
 */
export function itensParaBaixa(
  conciliadas: GuiaConciliada[]
): { lancamento_id: string; valor: number }[] {
  return conciliadas
    .filter(
      (g) =>
        (g.situacao === "paga" || g.situacao === "divergente") &&
        g.lancamento_id !== null &&
        g.valor_pago > 0
    )
    .map((g) => ({
      lancamento_id: g.lancamento_id as string,
      valor: Math.min(g.valor_pago, g.valor_devido ?? g.valor_pago),
    }));
}
