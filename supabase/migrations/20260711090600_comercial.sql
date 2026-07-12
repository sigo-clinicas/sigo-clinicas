-- =============================================================================
-- 0600 COMERCIAL — funil orçamento (kanban rascunho→enviado→aprovado/recusado)
-- → venda (botão Vender) → pagamento (parcelas). Normaliza o Base44:
-- itens[] → item_orcamento; venda_parcelas[] → pagamento;
-- lancamento_financeiro_ids[] → FK em lancamento_financeiro (migration 0700).
-- A conversão orçamento→venda→parcelas→lançamentos será uma RPC transacional
-- (`vender_orcamento`, Sprint 3) — o schema já a suporta.
-- =============================================================================

create table public.orcamento (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null references public.clinica (id) on delete cascade,
  paciente_id        uuid not null references public.paciente (id),
  profissional_id    uuid references public.profissional (id) on delete set null,
  convenio_id        uuid references public.convenio (id) on delete set null,
  tabela_preco_id    uuid references public.tabela_preco (id) on delete set null,
  status             public.status_orcamento not null default 'rascunho',
  validade_dias      int not null default 30,
  valor_total        numeric(12,2) not null default 0,
  tipo_desconto      public.tipo_desconto not null default 'percentual',
  desconto           numeric(12,2) not null default 0,
  valor_final        numeric(12,2) not null default 0,
  observacoes        text,
  anotacoes_internas text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_orcamento_clinica_status
  on public.orcamento (clinica_id, status);
create index idx_orcamento_paciente on public.orcamento (paciente_id);

-- Itens do orçamento. `regioes` atende odontograma/mapa de estética do Base44.
create table public.item_orcamento (
  id                  uuid primary key default gen_random_uuid(),
  clinica_id          uuid not null references public.clinica (id) on delete cascade,
  orcamento_id        uuid not null references public.orcamento (id) on delete cascade,
  servico_id          uuid not null references public.servico (id),
  quantidade          numeric(10,2) not null default 1,
  valor_unitario      numeric(12,2) not null default 0,
  valor_total         numeric(12,2) not null default 0,
  tipo_valor          public.tipo_valor_preco not null default 'fixo',
  regioes             text[] not null default '{}',
  observacao          text,
  sessoes_realizadas  int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_item_orcamento_orcamento
  on public.item_orcamento (orcamento_id);

-- Vínculo consulta ↔ item do plano de tratamento (agenda_has_servico.
-- orcamento_servico_id do legado; controla sessoes_realizadas).
alter table public.consulta_servico
  add column item_orcamento_id uuid
    references public.item_orcamento (id) on delete set null;

create table public.venda (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinica (id) on delete cascade,
  orcamento_id    uuid not null unique references public.orcamento (id),
  data_hora       timestamptz not null default now(),
  forma_pagamento public.forma_pagamento,
  cancelada       boolean not null default false,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Parcelas da venda (venda_parcelas[] do Base44, normalizado).
-- lancamento_id (contas a receber gerado) é adicionado na migration 0700.
create table public.pagamento (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinica (id) on delete cascade,
  venda_id        uuid not null references public.venda (id) on delete cascade,
  numero_parcela  int not null default 1,
  valor           numeric(12,2) not null check (valor >= 0),
  vencimento      date not null,
  pago            boolean not null default false,
  data_pagamento  date,
  forma_pagamento public.forma_pagamento,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (venda_id, numero_parcela)
);

-- RLS — matriz do legado: recepção/assistente operam o funil; profissional
-- cria/edita orçamentos (sem delete); financeiro da venda fica no 0700.
call app.aplicar_padrao_tenant('orcamento',
  array['proprietario','gerente','recepcionista','assistente','profissional'],
  array['proprietario','gerente','recepcionista','assistente']);
call app.aplicar_padrao_tenant('item_orcamento',
  array['proprietario','gerente','recepcionista','assistente','profissional'],
  array['proprietario','gerente','recepcionista','assistente']);
call app.aplicar_padrao_tenant('venda',
  array['proprietario','gerente','recepcionista','assistente']);
call app.aplicar_padrao_tenant('pagamento',
  array['proprietario','gerente','recepcionista','assistente']);

-- Paciente vê os próprios orçamentos (legado: cliente GET Orcamentos)
create policy orcamento_select_paciente on public.orcamento
  for select to authenticated
  using (paciente_id = app.paciente_id());

create policy item_orcamento_select_paciente on public.item_orcamento
  for select to authenticated
  using (exists (
    select 1 from public.orcamento o
    where o.id = orcamento_id and o.paciente_id = app.paciente_id()
  ));
