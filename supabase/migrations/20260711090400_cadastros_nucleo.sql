-- =============================================================================
-- 0400 CADASTROS-NÚCLEO (tenant): convênio, serviço UNIFICADO (A4:
-- Servico×Procedimento fundidos; preço via tabela de preço), tabelas de preço,
-- profissional (+ especialidades N:N, serviços/comissão N:N, convênios N:N,
-- intervalos de disponibilidade — modelo do legado profissional_has_intervalo).
-- Papéis de escrita seguem a matriz do AuthorizationListener do legado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Convênio (por clínica)
-- -----------------------------------------------------------------------------
create table public.convenio (
  id                   uuid primary key default gen_random_uuid(),
  clinica_id           uuid not null references public.clinica (id) on delete cascade,
  nome                 text not null,
  codigo               text,
  tipo                 public.tipo_convenio not null default 'plano_saude',
  contato              text,
  prazo_pagamento_dias int,
  observacoes          text,
  ativo                boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (clinica_id, nome)
);

-- Dados de convênio do paciente são POR CLÍNICA (ficam no vínculo, não no
-- cadastro global — corrige a modelagem single-tenant do Base44).
alter table public.paciente_clinica
  add column convenio_id         uuid references public.convenio (id) on delete set null,
  add column numero_carteirinha  text;

-- -----------------------------------------------------------------------------
-- Serviço unificado (A4). `exibir_publico` = flag de marketplace
-- (clinica_has_servico.agendamento_externo do legado). Preços NÃO moram aqui:
-- moram em item_tabela_preco (SUS/convênio/particular — modelo do legado).
-- `markup_percentual` apoia a composição de custo (estoque, M4).
-- -----------------------------------------------------------------------------
create table public.servico (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null references public.clinica (id) on delete cascade,
  especialidade_id  uuid references public.especialidade (id),
  nome              text not null,
  codigo            text,
  descricao         text,
  duracao_minutos   int not null default 30,
  exibir_publico    boolean not null default false,
  markup_percentual numeric(8,2),
  observacoes       text,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (clinica_id, nome)
);

create index idx_servico_clinica on public.servico (clinica_id) where ativo;

-- -----------------------------------------------------------------------------
-- Tabela de preço + itens (SUS/convênio/particular).
-- convenio_id null = tabela particular. `exibir_publico` = exibir_site legado.
-- -----------------------------------------------------------------------------
create table public.tabela_preco (
  id             uuid primary key default gen_random_uuid(),
  clinica_id     uuid not null references public.clinica (id) on delete cascade,
  nome           text not null,
  convenio_id    uuid references public.convenio (id) on delete set null,
  descricao      text,
  exibir_publico boolean not null default false,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (clinica_id, nome)
);

create table public.item_tabela_preco (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinica (id) on delete cascade,
  tabela_preco_id uuid not null references public.tabela_preco (id) on delete cascade,
  servico_id      uuid not null references public.servico (id) on delete cascade,
  tipo_valor      public.tipo_valor_preco not null default 'fixo',
  valor           numeric(12,2),
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tabela_preco_id, servico_id),
  check (tipo_valor = 'gratuito' or valor is not null)
);

-- -----------------------------------------------------------------------------
-- Profissional. Campos de agenda (horario/dias) seguem o Base44 (pixel
-- parity); bloqueios/exceções ficam em profissional_intervalo (legado).
-- `user_id` liga ao login (papel 'profissional' em clinica_usuario).
-- -----------------------------------------------------------------------------
create table public.profissional (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null references public.clinica (id) on delete cascade,
  user_id          uuid references auth.users (id) on delete set null,
  nome             text not null,
  cpf              text,
  data_nascimento  date,
  sexo             public.sexo,
  email            text,
  telefone         text,
  nome_conselho    text,
  numero_registro  text,
  cor              text,
  foto_path        text,
  horario_inicio   time,
  horario_fim      time,
  dias_atendimento smallint[] not null default '{}',
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (clinica_id, user_id)
);

create index idx_profissional_clinica on public.profissional (clinica_id) where ativo;

-- Especialidades do profissional (N:N, multisseleção — decisão da call 02/07)
create table public.profissional_especialidade (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null references public.clinica (id) on delete cascade,
  profissional_id  uuid not null references public.profissional (id) on delete cascade,
  especialidade_id uuid not null references public.especialidade (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (profissional_id, especialidade_id)
);

-- Serviços que o profissional executa + comissão (profissional_has_servico
-- do legado + servicos_comissao do Base44)
create table public.profissional_servico (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinica (id) on delete cascade,
  profissional_id uuid not null references public.profissional (id) on delete cascade,
  servico_id      uuid not null references public.servico (id) on delete cascade,
  tipo_comissao   public.tipo_comissao not null default 'percentual',
  valor_comissao  numeric(12,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (profissional_id, servico_id)
);

-- Convênios aceitos pelo profissional (convenios_aceitos[] do Base44 → N:N)
create table public.profissional_convenio (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinica (id) on delete cascade,
  profissional_id uuid not null references public.profissional (id) on delete cascade,
  convenio_id     uuid not null references public.convenio (id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (profissional_id, convenio_id)
);

-- Intervalos de INDISPONIBILIDADE (almoço, férias, bloqueios) — legado.
-- fixo    → recorrente por dia_semana + hora_inicio/hora_fim
-- pontual → janela data_hora_inicio/data_hora_fim
create table public.profissional_intervalo (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null references public.clinica (id) on delete cascade,
  profissional_id  uuid not null references public.profissional (id) on delete cascade,
  tipo             public.tipo_intervalo not null default 'fixo',
  motivo           text not null default 'Almoço',
  dia_semana       smallint check (dia_semana between 0 and 6),
  hora_inicio      time,
  hora_fim         time,
  data_hora_inicio timestamptz,
  data_hora_fim    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (
    (tipo = 'fixo'    and dia_semana is not null and hora_inicio is not null and hora_fim is not null)
    or
    (tipo = 'pontual' and data_hora_inicio is not null and data_hora_fim is not null)
  )
);

create index idx_intervalo_profissional
  on public.profissional_intervalo (profissional_id);

-- -----------------------------------------------------------------------------
-- RLS — cadastros são geridos por proprietário/gerente (matriz do legado);
-- demais papéis leem. Marketplace (anon) lê o que for público.
-- -----------------------------------------------------------------------------
call app.aplicar_padrao_tenant('convenio',          array['proprietario','gerente']);
call app.aplicar_padrao_tenant('servico',           array['proprietario','gerente']);
call app.aplicar_padrao_tenant('tabela_preco',      array['proprietario','gerente']);
call app.aplicar_padrao_tenant('item_tabela_preco', array['proprietario','gerente']);
call app.aplicar_padrao_tenant('profissional',      array['proprietario','gerente']);
call app.aplicar_padrao_tenant('profissional_especialidade', array['proprietario','gerente']);
call app.aplicar_padrao_tenant('profissional_servico',       array['proprietario','gerente']);
call app.aplicar_padrao_tenant('profissional_convenio',      array['proprietario','gerente']);
-- Intervalos: recepção/assistente também gerenciam (agenda), e o próprio
-- profissional gerencia os seus (policy adicional abaixo — legado permitia).
call app.aplicar_padrao_tenant('profissional_intervalo',
  array['proprietario','gerente','recepcionista','assistente']);

create policy intervalo_profissional_proprio on public.profissional_intervalo
  for all to authenticated
  using (exists (
    select 1 from public.profissional p
    where p.id = profissional_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.profissional p
    where p.id = profissional_id and p.user_id = auth.uid()
  ));

-- Profissional atualiza o próprio cadastro (legado: PUT/PATCH em Profissionais)
create policy profissional_update_proprio on public.profissional
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Marketplace público (guest do legado): serviços/preços/profissionais
-- visíveis das clínicas ativas no marketplace.
create policy servico_select_marketplace on public.servico
  for select to anon, authenticated
  using (
    ativo and exibir_publico
    and exists (select 1 from public.clinica c
                where c.id = clinica_id and c.ativo and c.exibir_marketplace)
  );

create policy tabela_preco_select_marketplace on public.tabela_preco
  for select to anon, authenticated
  using (
    ativo and exibir_publico
    and exists (select 1 from public.clinica c
                where c.id = clinica_id and c.ativo and c.exibir_marketplace)
  );

create policy item_tabela_preco_select_marketplace on public.item_tabela_preco
  for select to anon, authenticated
  using (
    ativo
    and exists (select 1 from public.tabela_preco tp
                where tp.id = tabela_preco_id and tp.ativo and tp.exibir_publico)
    and exists (select 1 from public.clinica c
                where c.id = clinica_id and c.ativo and c.exibir_marketplace)
  );

create policy profissional_select_marketplace on public.profissional
  for select to anon, authenticated
  using (
    ativo
    and exists (select 1 from public.clinica c
                where c.id = clinica_id and c.ativo and c.exibir_marketplace)
  );

create policy profissional_especialidade_select_marketplace
  on public.profissional_especialidade
  for select to anon, authenticated
  using (exists (select 1 from public.clinica c
                 where c.id = clinica_id and c.ativo and c.exibir_marketplace));
