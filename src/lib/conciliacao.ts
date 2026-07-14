// S3-4 — Conciliação bancária manual (porta de reference/base44 ContaDetalhe/
// Conciliacao). Parser de extrato CSV + auto-match contra movimentacao_conta.
// Módulo PURO (sem "use server"/"use client") — testável isoladamente.

export type LinhaExtrato = { data: string; descricao: string; valor: number };

export type MovSimples = {
  id: string;
  data: string; // YYYY-MM-DD
  valor: number;
  tipo: "entrada" | "saida";
  conciliada: boolean;
};

/** Valor assinado da movimentação: entrada (+), saída (−). */
export function valorAssinado(m: Pick<MovSimples, "valor" | "tipo">): number {
  return m.tipo === "entrada" ? Number(m.valor) : -Number(m.valor);
}

/** Normaliza "1.234,56" ou "1234.56" ou "-50,00" → number. */
function parseValor(raw: string): number {
  const s = raw.trim().replace(/\s/g, "");
  if (s.includes(",")) {
    // formato BR: ponto de milhar, vírgula decimal
    return Number(s.replace(/\./g, "").replace(",", "."));
  }
  return Number(s);
}

/** Normaliza data dd/mm/yyyy | dd-mm-yyyy | yyyy-mm-dd → YYYY-MM-DD. */
function parseData(raw: string): string {
  const s = raw.trim();
  const br = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return s;
}

/**
 * Extrato CSV "Data;Descrição;Valor" (valor positivo = crédito). Ignora
 * cabeçalho e linhas vazias. Aceita separador `;` ou `,` quando não houver `;`.
 */
export function parseExtratoCSV(texto: string): LinhaExtrato[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  const out: LinhaExtrato[] = [];
  for (const linha of linhas) {
    const sep = linha.includes(";") ? ";" : ",";
    const partes = linha.split(sep);
    if (partes.length < 3) continue;
    const [dataRaw, descRaw, valorRaw] = partes;
    // pula cabeçalho (valor não numérico)
    const valor = parseValor(valorRaw);
    if (Number.isNaN(valor)) continue;
    out.push({ data: parseData(dataRaw), descricao: descRaw.trim(), valor });
  }
  return out;
}

function diffDias(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  return Math.abs(da - db) / 86_400_000;
}

/**
 * Auto-match: casa cada linha do extrato à primeira movimentação NÃO conciliada
 * ainda não usada, por valor (±0,02) e data (±`toleranciaDias`, default 3).
 * Retorna Map<indiceLinhaExtrato, movimentacaoId>.
 */
export function autoMatch(
  linhas: LinhaExtrato[],
  movs: MovSimples[],
  toleranciaDias = 3
): Map<number, string> {
  const resultado = new Map<number, string>();
  const usados = new Set<string>();
  const disponiveis = movs.filter((m) => !m.conciliada);

  linhas.forEach((linha, idx) => {
    const alvo = disponiveis.find(
      (m) =>
        !usados.has(m.id) &&
        Math.abs(valorAssinado(m) - linha.valor) <= 0.02 &&
        diffDias(m.data, linha.data) <= toleranciaDias
    );
    if (alvo) {
      resultado.set(idx, alvo.id);
      usados.add(alvo.id);
    }
  });

  return resultado;
}
