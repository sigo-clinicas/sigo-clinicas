-- =============================================================================
-- S5 — clinica_horario: horário de funcionamento da clínica (vitrine + limite
-- externo dos slots no S6).
--
-- TABELA, não blob (decisão da liderança): o legado provou que jsonb de horário
-- apodrece — clinica.horarios usava {abertura,fechamento} e profissional.horarios
-- {inicio,fim}, shapes incompatíveis, e o horário da clínica virava decorativo.
-- A coluna clinica.horarios (jsonb, morta no app) fica órfã — candidata a limpeza.
--
-- Modelo: 1 intervalo por dia (abertura–fechamento). Dia AUSENTE = fechado.
-- Pausas mais finas (almoço) são do profissional (profissional_intervalo), que o
-- S6 subtrai na geração de slots. Split de horário da clínica é refinamento F2.
--
-- dia_semana 0-6 na convenção getDay() (0=domingo), a mesma de
-- disponibilidade.ts/agenda-publica.ts — coerência com o cálculo de slots do S6.
-- =============================================================================

create table public.clinica_horario (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references public.clinica (id) on delete cascade,
  dia_semana  smallint not null check (dia_semana between 0 and 6),
  abertura    time not null,
  fechamento  time not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (fechamento > abertura),
  unique (clinica_id, dia_semana)
);

create index idx_clinica_horario_clinica on public.clinica_horario (clinica_id);

-- RLS tenant padrão: staff lê (membro); proprietário/gerente escreve (config filha
-- da clínica, mesmo gate de clinica_especialidade).
call app.aplicar_padrao_tenant('clinica_horario', array['proprietario', 'gerente']);

-- Marketplace público: anon lê o horário de clínicas públicas. Sem colunas
-- sensíveis → sem allowlist. Tabela nova → anon já tem SELECT de tabela por
-- default do Supabase (como servico/clinica_especialidade); basta a policy.
create policy clinica_horario_select_marketplace
  on public.clinica_horario
  for select to anon, authenticated
  using (exists (
    select 1 from public.clinica c
    where c.id = clinica_id and c.ativo and c.exibir_marketplace
  ));
