// S1 — Cruzamento serviço↔profissional (lógica pura, testável).
//
// A adjacência `profissional_servico` é OPCIONAL: nem toda clínica a mapeia.
// Regra de ouro: só FILTRA onde há dado; nunca esconde por ausência de dado.
// Sem isso, uma clínica sem vínculos veria as duas listas somem — regressão
// sobre o comportamento anterior (mostrava tudo).

export type Vinculo = { servico_id: string; profissional_id: string };
export type Opcao = { id: string };

/** Profissionais que atendem TODOS os serviços marcados (AND). */
export function profissionaisParaServicos<P extends Opcao>(
  profissionais: P[],
  vinculos: Vinculo[],
  servicoIds: string[]
): P[] {
  const profsPorServico = new Map<string, Set<string>>();
  for (const v of vinculos) {
    if (!profsPorServico.has(v.servico_id)) profsPorServico.set(v.servico_id, new Set());
    profsPorServico.get(v.servico_id)!.add(v.profissional_id);
  }
  // Só restringe pelos serviços que TÊM adjacência; serviço sem dado não filtra.
  const comAdjacencia = servicoIds.filter((sid) => profsPorServico.has(sid));
  if (comAdjacencia.length === 0) return profissionais;
  return profissionais.filter((p) =>
    comAdjacencia.every((sid) => profsPorServico.get(sid)!.has(p.id))
  );
}

/** Serviços que o profissional selecionado faz. Se ele não tem adjacência
 *  mapeada (ou nenhum profissional foi escolhido), devolve todos. */
export function servicosParaProfissional<S extends Opcao>(
  servicos: S[],
  vinculos: Vinculo[],
  profissionalId: string | null
): S[] {
  if (!profissionalId) return servicos;
  const doProf = new Set(
    vinculos.filter((v) => v.profissional_id === profissionalId).map((v) => v.servico_id)
  );
  if (doProf.size === 0) return servicos; // profissional sem adjacência → não esconde
  return servicos.filter((s) => doProf.has(s.id));
}
