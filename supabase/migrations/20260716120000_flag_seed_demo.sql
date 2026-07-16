-- =============================================================================
-- Rastreabilidade do seed de homologação por FLAG dedicada, no lugar do marcador
-- "[TESTE]" no nome. O "[TESTE]" poluía a apresentação pública (marketplace),
-- então foi removido dos dados; a flag `is_seed_demo` passa a ser o alvo do
-- teardown (scripts/seed-teste-cleanup.sql e seed-teste.mjs --teardown).
--
-- Só clinica e paciente carregam a flag: são as duas âncoras do teardown. Todo o
-- resto do cenário de teste cascateia da clínica (FK clinica_id) e os pacientes
-- órfãos são varridos a partir dela.
-- =============================================================================

alter table public.clinica
  add column if not exists is_seed_demo boolean not null default false;
alter table public.paciente
  add column if not exists is_seed_demo boolean not null default false;

comment on column public.clinica.is_seed_demo is
  'true = clínica de seed de homologação (substitui o antigo marcador [TESTE] no nome). Alvo do teardown; o cascade do FK clinica_id remove todo o cenário.';
comment on column public.paciente.is_seed_demo is
  'true = paciente de seed de homologação (substitui o antigo marcador [TESTE] no nome). Alvo do teardown.';

-- Backfill: marca os dados de teste ATUAIS enquanto o "[TESTE]" ainda está no
-- nome (a remoção do marcador acontece logo em seguida, já apoiada nesta flag).
update public.clinica  set is_seed_demo = true where nome like '[TESTE]%';
update public.paciente set is_seed_demo = true where nome like '[TESTE]%';
