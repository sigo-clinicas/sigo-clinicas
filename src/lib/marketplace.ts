import "server-only";

import { createClient } from "@/lib/supabase/server";
import { rotuloPreco, type ItemPreco } from "@/lib/preco";
import { agruparCidades } from "@/lib/busca";

// S4 — teto EXPLÍCITO das coleções do marketplace. O PostgREST já corta em
// `max_rows` (config.toml = 1000) de forma SILENCIOSA; deixamos o limite visível
// no código para o truncamento ser explícito, não uma surpresa de config. Além
// deste volume, o correto é paginação por keyset + push-down no Postgres (Fase 2
// — exige materializar o ranking, hoje função por linha na view).
const MAX_MARKETPLACE = 1000;

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
  fotos: string[] | null; // paths no bucket público `logos` (carrossel)
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
  fotos?: unknown; // jsonb; só clinicaPorSlug seleciona (nas cartas fica null)
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
    fotos: Array.isArray(r.fotos) ? (r.fotos as string[]) : null,
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
    .select("id,slug,nome,tipo,cidade,uf,bairro,sobre,logo_path,ranking")
    .limit(MAX_MARKETPLACE);
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
    .not("cidade", "is", null)
    .limit(MAX_MARKETPLACE);
  // S4 — agrupa grafias divergentes (acento/caixa) numa cidade canônica.
  return agruparCidades((data ?? []).map((c) => c.cidade as string));
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
  clinica: ClinicaPublica & {
    telefone: string | null;
    email: string | null;
    // S2 — endereço completo (colunas já liberadas ao anon na allowlist do S0)
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    cep: string | null;
    // S2 — única coluna nova da fase
    formas_pagamento: string[] | null;
    // S6 — fuso da clínica (formatação dos slots no horário local)
    timezone: string;
  };
  servicos: {
    id: string;
    nome: string;
    descricao: string | null;
    duracao_minutos: number | null;
    // S3 — rótulo pronto (fixo/a partir de/gratuito/sob consulta), determinístico
    precoLabel: string;
  }[];
  profissionais: {
    id: string;
    nome: string;
    nome_conselho: string | null;
    numero_registro: string | null;
    foto_path: string | null; // S2 — foto real (bucket público `logos`)
  }[];
  depoimentos: { id: string; paciente_nome: string; texto: string; nota: number | null }[];
  // S1 — adjacência serviço↔profissional (só vínculos públicos, via a policy
  // profissional_servico_select_marketplace). A comissão fica de fora por
  // allowlist de coluna. O cliente cruza nos dois sentidos em memória.
  vinculos: { servico_id: string; profissional_id: string }[];
  // S5 — horário de funcionamento (clinica_horario). dia_semana getDay (0=dom).
  horarios: { dia_semana: number; abertura: string; fechamento: string }[];
};

export async function clinicaPorSlug(slug: string): Promise<PaginaClinica | null> {
  const supabase = createClient();
  const { data: baseRow } = await supabase
    .from("marketplace_clinica")
    .select("id,slug,nome,tipo,cidade,uf,bairro,sobre,logo_path,fotos,ranking")
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
    { data: horarios },
  ] = await Promise.all([
    // Base da clínica: colunas públicas já liberadas ao anon (S0/S2), coluna a
    // coluna — nunca colunas internas (cnpj/config/razao_social).
    supabase
      .from("clinica")
      .select("telefone,email,logradouro,numero,complemento,cep,formas_pagamento,timezone")
      .eq("id", base.id)
      .maybeSingle(),
    supabase
      .from("servico")
      .select("id,nome,descricao,duracao_minutos")
      .eq("clinica_id", base.id)
      .eq("ativo", true)
      .eq("exibir_publico", true)
      .order("nome"),
    supabase
      .from("profissional")
      .select("id,nome,nome_conselho,numero_registro,foto_path")
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
    // tabela_preco(nome) p/ desempate determinístico do rótulo (S3). A RLS de
    // item_tabela_preco/tabela_preco só expõe tabelas públicas ao anon.
    supabase
      .from("item_tabela_preco")
      .select("servico_id,valor,tipo_valor,tabela_preco(nome)")
      .eq("clinica_id", base.id),
    // Coluna a coluna: a policy expõe a linha, mas a allowlist já barra a
    // comissão — selecionar só o par do cruzamento é defesa em profundidade.
    supabase
      .from("profissional_servico")
      .select("servico_id,profissional_id")
      .eq("clinica_id", base.id),
    // S5 — horário de funcionamento (clinica_horario, policy anon de marketplace).
    supabase
      .from("clinica_horario")
      .select("dia_semana,abertura,fechamento")
      .eq("clinica_id", base.id)
      .order("dia_semana"),
  ]);

  // Agrupa itens PÚBLICOS por serviço preservando tipo_valor + nome da tabela;
  // o rótulo determinístico é decidido em @/lib/preco (corrige os 2 defeitos do
  // legado: "Gratuito" dead code e tabelaSite[0] sem ORDER BY).
  const itensPorServico = new Map<string, ItemPreco[]>();
  for (const p of precos ?? []) {
    const lista = itensPorServico.get(p.servico_id) ?? [];
    lista.push({
      tipo_valor: p.tipo_valor,
      valor: p.valor == null ? null : Number(p.valor),
      tabela_nome: (p.tabela_preco as { nome: string } | null)?.nome ?? null,
    });
    itensPorServico.set(p.servico_id, lista);
  }

  return {
    clinica: {
      ...base,
      telefone: extra?.telefone ?? null,
      email: extra?.email ?? null,
      logradouro: extra?.logradouro ?? null,
      numero: extra?.numero ?? null,
      complemento: extra?.complemento ?? null,
      cep: extra?.cep ?? null,
      formas_pagamento: (extra?.formas_pagamento as string[] | null) ?? null,
      timezone: extra?.timezone ?? "America/Sao_Paulo",
    },
    servicos: (servicos ?? []).map((s) => ({
      ...s,
      precoLabel: rotuloPreco(itensPorServico.get(s.id) ?? []),
    })),
    profissionais: profissionais ?? [],
    depoimentos: depoimentos ?? [],
    vinculos: vinculos ?? [],
    horarios: horarios ?? [],
  };
}
