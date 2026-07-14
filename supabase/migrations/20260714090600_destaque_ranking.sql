-- =============================================================================
-- S3-6 — Estrutura de DESTAQUE/ranqueamento do marketplace (parametrizável).
-- O MODELO DE COBRANÇA do destaque é decisão pendente da cliente (CLAUDE.md §9.1)
-- → aqui só a ESTRUTURA: um enum de nível + uma tabela de config + UM ÚNICO
-- ponto de leitura (marketplace_ranking_score). Default NEUTRO (score 0 p/ todas
-- → empate → desempate por nome). Quando a cobrança for decidida, muda-se só
-- esta função/tabela, sem espalhar lógica pela busca. NENHUMA lógica de
-- faturamento aqui. Cupons já existem (0600/1000) — só ganham CRUD no painel.
-- =============================================================================

create type public.nivel_destaque as enum ('neutro', 'parceiro', 'premium');

create table public.clinica_destaque (
  clinica_id      uuid primary key references public.clinica (id) on delete cascade,
  nivel           public.nivel_destaque not null default 'neutro',
  score_manual    int not null default 0,
  ativo           boolean not null default true,
  vigencia_inicio date,
  vigencia_fim    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_updated_at
  before update on public.clinica_destaque
  for each row execute function app.set_updated_at();

alter table public.clinica_destaque enable row level security;

-- Leitura pública só de clínicas públicas ativas
create policy clinica_destaque_select_marketplace on public.clinica_destaque
  for select to anon, authenticated
  using (
    ativo and exists (
      select 1 from public.clinica c
      where c.id = clinica_id and c.ativo and c.exibir_marketplace
    )
  );

-- Escrita só admin de plataforma (monetização é decisão de plataforma)
create policy clinica_destaque_admin on public.clinica_destaque
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

-- Ponto ÚNICO de leitura do ranqueamento. Default neutro: score_manual (0) +
-- média das notas dos depoimentos públicos aprovados (0 se não houver). O
-- `nivel` é rótulo p/ o modelo de cobrança futuro; NÃO entra no score agora.
create or replace function public.marketplace_ranking_score(p_clinica_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce((
      select cd.score_manual
      from public.clinica_destaque cd
      where cd.clinica_id = p_clinica_id
        and cd.ativo
        and (cd.vigencia_inicio is null or cd.vigencia_inicio <= current_date)
        and (cd.vigencia_fim is null or cd.vigencia_fim >= current_date)
    ), 0)
    + coalesce((
      select avg(d.nota)
      from public.depoimento d
      where d.clinica_id = p_clinica_id
        and d.status = 'aprovado'
        and d.publicar_no_site
        and d.nota is not null
    ), 0);
$$;

grant execute on function public.marketplace_ranking_score(uuid) to anon, authenticated;
