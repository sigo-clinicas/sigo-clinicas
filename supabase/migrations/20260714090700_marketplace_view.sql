-- =============================================================================
-- S3-7 — View pública do marketplace: clínicas públicas + score de ranqueamento
-- (ponto único marketplace_ranking_score). security_invoker=on → a RLS da
-- clinica (clinica_select_marketplace) decide o que aparece; a view só expõe
-- colunas públicas. Ordenar por `ranking` desc, `nome` asc na aplicação.
-- Nenhum dado de paciente/financeiro aqui.
-- =============================================================================

create view public.marketplace_clinica
  with (security_invoker = on)
as
select
  c.id,
  c.slug,
  c.nome,
  c.tipo,
  c.cidade,
  c.uf,
  c.bairro,
  c.sobre,
  c.logo_path,
  c.fotos,
  public.marketplace_ranking_score(c.id) as ranking
from public.clinica c
where c.ativo and c.exibir_marketplace;

grant select on public.marketplace_clinica to anon, authenticated;
