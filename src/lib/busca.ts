// S4 — normalização de cidade e pipeline de filtro da busca (lógica pura).
//
// O /buscar NOVO já compõe os filtros num pipeline único (AND entre grupos, OR
// dentro) e não herdou os bugs do legado (teto de 25, 3 motores concorrentes).
// O que faltava:
//  - MATCH de cidade acento/caixa-insensível: grafias divergentes na base
//    ("São Paulo" vs "SÃO PAULO" vs "sao paulo") viravam cidades distintas, e
//    marcar uma não pegava as outras. Aqui uma clínica em "SÃO PAULO" casa com a
//    seleção "São Paulo".
//  - Composição TESTÁVEL: extraída para função pura, guardada por teste de
//    caracterização (o legado não tinha nenhum).

/** Chave canônica de cidade: sem acento, minúscula, espaços colapsados. */
export function chaveCidade(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos combinantes
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Escolhe a grafia de exibição de um grupo: prefere Título ("São Paulo") a tudo
 *  minúsculo ("são paulo") e a CAIXA ALTA ("SÃO PAULO"); desempate alfabético
 *  pt-BR. Determinístico. */
function escoreGrafia(s: string): number {
  if (s === s.toUpperCase()) return 2; // CAIXA ALTA — pior
  if (s === s.toLowerCase()) return 1; // tudo minúsculo
  return 0; // caixa mista (Título) — melhor
}

function grafiaCanonica(grupo: string[]): string {
  return [...grupo].sort(
    (a, b) => escoreGrafia(a) - escoreGrafia(b) || a.localeCompare(b, "pt-BR")
  )[0];
}

/** Agrupa grafias divergentes numa cidade canônica; dedup por chave, ordenado. */
export function agruparCidades(cidades: string[]): string[] {
  const porChave = new Map<string, string[]>();
  for (const c of cidades) {
    const k = chaveCidade(c);
    if (!k) continue;
    const grupo = porChave.get(k);
    if (grupo) grupo.push(c);
    else porChave.set(k, [c]);
  }
  return [...porChave.values()]
    .map(grafiaCanonica)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export type CriteriosBusca = {
  tipo: string | null;
  cidades: string[];
  especialidades: string[];
};

/**
 * Pipeline de filtro (composição): tipo AND cidade AND especialidade.
 * OR dentro de cidade (acento/caixa-insensível) e de especialidade.
 * Passagem única — nunca os 3 motores concorrentes do legado.
 */
export function filtrarClinicas<
  T extends { id: string; tipo: string | null; cidade: string | null }
>(
  clinicas: T[],
  criterios: CriteriosBusca,
  espIdsPorClinica: Map<string, string[]>
): T[] {
  const chavesCidade = new Set(criterios.cidades.map(chaveCidade).filter(Boolean));
  return clinicas.filter((c) => {
    if (criterios.tipo && c.tipo !== criterios.tipo) return false;
    if (chavesCidade.size && !(c.cidade && chavesCidade.has(chaveCidade(c.cidade)))) return false;
    if (criterios.especialidades.length) {
      const ids = espIdsPorClinica.get(c.id) ?? [];
      if (!ids.some((id) => criterios.especialidades.includes(id))) return false;
    }
    return true;
  });
}
