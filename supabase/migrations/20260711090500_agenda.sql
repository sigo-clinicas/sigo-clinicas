-- =============================================================================
-- 0500 AGENDA — consulta (agendamento) + consulta_servico (N:N, corrige A4:
-- Base44 tinha servicos[] E servico_id simultâneos).
-- Escrita: proprietário/gerente/recepcionista/assistente (matriz do legado —
-- profissional só lê a agenda). Paciente logado enxerga as próprias consultas;
-- agendamento público do marketplace entra via Server Action/RPC no S3.
-- =============================================================================

create table public.consulta (
  id                  uuid primary key default gen_random_uuid(),
  clinica_id          uuid not null references public.clinica (id) on delete cascade,
  paciente_id         uuid not null references public.paciente (id),
  profissional_id     uuid not null references public.profissional (id),
  convenio_id         uuid references public.convenio (id) on delete set null,
  data_hora           timestamptz not null,
  duracao_minutos     int not null default 30,
  tipo                public.tipo_consulta not null default 'consulta',
  status              public.status_consulta not null default 'agendado',
  motivo_cancelamento text,
  forma_pagamento     public.forma_pagamento,
  valor               numeric(12,2),
  numero_guia         text,
  observacoes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_consulta_clinica_data
  on public.consulta (clinica_id, data_hora);
create index idx_consulta_profissional_data
  on public.consulta (clinica_id, profissional_id, data_hora);
create index idx_consulta_paciente
  on public.consulta (paciente_id);

-- Serviços realizados na consulta. item_orcamento_id (vínculo com plano de
-- tratamento vendido) é adicionado na migration 0600 (comercial).
create table public.consulta_servico (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references public.clinica (id) on delete cascade,
  consulta_id uuid not null references public.consulta (id) on delete cascade,
  servico_id  uuid not null references public.servico (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (consulta_id, servico_id)
);

call app.aplicar_padrao_tenant('consulta',
  array['proprietario','gerente','recepcionista','assistente']);
call app.aplicar_padrao_tenant('consulta_servico',
  array['proprietario','gerente','recepcionista','assistente']);

-- Paciente logado vê as próprias consultas (portal/agendamentos)
create policy consulta_select_paciente on public.consulta
  for select to authenticated
  using (paciente_id = app.paciente_id());

create policy consulta_servico_select_paciente on public.consulta_servico
  for select to authenticated
  using (exists (
    select 1 from public.consulta c
    where c.id = consulta_id and c.paciente_id = app.paciente_id()
  ));
