import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * S3-7 — Consultas públicas do marketplace. Leem via client da sessão (anon
 * quando deslogado); a RLS *_select_marketplace decide o que é exposto. NUNCA
 * consultam paciente/consulta/financeiro (sem policy anon → negado por padrão).
 */

export type ClinicaPublica = {
  id: string;
  slug: string | null;
  nome: string;
  tipo: string | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  sobre: string | null;
  logo_path: string | null;
  ranking: number | null;
};

const ordenar = (a: ClinicaPublica, b: ClinicaPublica) =>
  Number(b.ranking ?? 0) - Number(a.ranking ?? 0) || a.nome.localeCompare(b.nome, "pt-BR");

// A view não carrega NOT NULL → colunas vêm `| null`. id/nome nunca são nulos
// na prática (colunas base NOT NULL); coagimos com segurança.
type LinhaView = {
  id: string | null;
  slug: string | null;
  nome: string | null;
  tipo: string | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  sobre: string | null;
  logo_path: string | null;
  ranking: number | null;
};

function toClinica(r: LinhaView): ClinicaPublica | null {
  if (!r.id || !r.nome) return null;
  return {
    id: r.id,
    slug: r.slug,
    nome: r.nome,
    tipo: r.tipo,
    cidade: r.cidade,
    uf: r.uf,
    bairro: r.bairro,
    sobre: r.sobre,
    logo_path: r.logo_path,
    ranking: r.ranking,
  };
}

export async function listarClinicas(filtros?: {
  cidade?: string;
  especialidade?: string;
}): Promise<ClinicaPublica[]> {
  const supabase = createClient();
  let ids: string[] | null = null;

  if (filtros?.especialidade) {
    const { data: ce } = await supabase
      .from("clinica_especialidade")
      .select("clinica_id")
      .eq("especialidade_id", filtros.especialidade);
    ids = (ce ?? []).map((x) => x.clinica_id);
    if (ids.length === 0) return [];
  }

  let query = supabase
    .from("marketplace_clinica")
    .select("id,slug,nome,tipo,cidade,uf,bairro,sobre,logo_path,ranking");
  if (filtros?.cidade) query = query.eq("cidade", filtros.cidade);
  if (ids) query = query.in("id", ids);

  const { data } = await query;
  return (data ?? [])
    .map(toClinica)
    .filter((c): c is ClinicaPublica => c !== null)
    .sort(ordenar);
}

export async function clinicasDestaque(limite = 6): Promise<ClinicaPublica[]> {
  const todas = await listarClinicas();
  return todas.slice(0, limite);
}

export async function listarCidades(): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("marketplace_clinica")
    .select("cidade")
    .not("cidade", "is", null);
  return [...new Set((data ?? []).map((c) => c.cidade as string))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

export type EspecialidadeOpcao = { id: string; nome: string; segmento: string | null };

export async function listarEspecialidades(): Promise<EspecialidadeOpcao[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("especialidade")
    .select("id,nome,segmento:segmento_id(nome)")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []).map((e) => ({
    id: e.id,
    nome: e.nome,
    segmento: (e.segmento as { nome: string } | null)?.nome ?? null,
  }));
}

export type PaginaClinica = {
  clinica: ClinicaPublica & { telefone: string | null; email: string | null };
  servicos: {
    id: string;
    nome: string;
    descricao: string | null;
    duracao_minutos: number | null;
    preco: number | null;
  }[];
  profissionais: { id: string; nome: string; nome_conselho: string | null; numero_registro: string | null }[];
  depoimentos: { id: string; paciente_nome: string; texto: string; nota: number | null }[];
  // S1 — adjacência serviço↔profissional (só vínculos públicos, via a policy
  // profissional_servico_select_marketplace). A comissão fica de fora por
  // allowlist de coluna. O cliente cruza nos dois sentidos em memória.
  vinculos: { servico_id: string; profissional_id: string }[];
};

export async function clinicaPorSlug(slug: string): Promise<PaginaClinica | null> {
  const supabase = createClient();
  const { data: baseRow } = await supabase
    .from("marketplace_clinica")
    .select("id,slug,nome,tipo,cidade,uf,bairro,sobre,logo_path,ranking")
    .eq("slug", slug)
    .maybeSingle();
  const base = baseRow ? toClinica(baseRow) : null;
  if (!base) return null;

  const [
    { data: extra },
    { data: servicos },
    { data: profissionais },
    { data: depoimentos },
    { data: precos },
    { data: vinculos },
  ] = await Promise.all([
    supabase.from("clinica").select("telefone,email").eq("id", base.id).maybeSingle(),
    supabase
      .from("servico")
      .select("id,nome,descricao,duracao_minutos")
      .eq("clinica_id", base.id)
      .eq("ativo", true)
      .eq("exibir_publico", true)
      .order("nome"),
    supabase
      .from("profissional")
      .select("id,nome,nome_conselho,numero_registro")
      .eq("clinica_id", base.id)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("depoimento")
      .select("id,paciente_nome,texto,nota")
      .eq("clinica_id", base.id)
      .eq("status", "aprovado")
      .eq("publicar_no_site", true)
      .order("destaque", { ascending: false })
      .limit(12),
    supabase
      .from("item_tabela_preco")
      .select("servico_id,valor,tipo_valor")
      .eq("clinica_id", base.id),
    // Coluna a coluna: a policy expõe a linha, mas a allowlist já barra a
    // comissão — selecionar só o par do cruzamento é defesa em profundidade.
    supabase
      .from("profissional_servico")
      .select("servico_id,profissional_id")
      .eq("clinica_id", base.id),
  ]);

  // menor preço público por serviço (item_tabela_preco só expõe tabelas públicas via RLS)
  const precoPorServico = new Map<string, number>();
  for (const p of precos ?? []) {
    if (p.tipo_valor === "gratuito") continue;
    const atual = precoPorServico.get(p.servico_id);
    const v = Number(p.valor);
    if (atual === undefined || v < atual) precoPorServico.set(p.servico_id, v);
  }

  return {
    clinica: { ...base, telefone: extra?.telefone ?? null, email: extra?.email ?? null },
    servicos: (servicos ?? []).map((s) => ({
      ...s,
      preco: precoPorServico.get(s.id) ?? null,
    })),
    profissionais: profissionais ?? [],
    depoimentos: depoimentos ?? [],
    vinculos: vinculos ?? [],
  };
}
