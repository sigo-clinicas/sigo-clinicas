-- =============================================================================
-- 1300 ESPECIALIDADES DA CLÍNICA (S1-4)
-- N:N clínica × especialidade (clinica_has_especialidade do legado) —
-- multisseleção decidida na call de 02/07. É a base da busca por
-- especialidade do marketplace (S3).
-- =============================================================================

create table public.clinica_especialidade (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null references public.clinica (id) on delete cascade,
  especialidade_id uuid not null references public.especialidade (id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (clinica_id, especialidade_id)
);

create index idx_clinica_especialidade_esp
  on public.clinica_especialidade (especialidade_id);

call app.aplicar_padrao_tenant('clinica_especialidade',
  array['proprietario','gerente']);

-- Marketplace: busca pública de clínicas por especialidade
create policy clinica_especialidade_select_marketplace
  on public.clinica_especialidade
  for select to anon, authenticated
  using (exists (
    select 1 from public.clinica c
    where c.id = clinica_id and c.ativo and c.exibir_marketplace
  ));
