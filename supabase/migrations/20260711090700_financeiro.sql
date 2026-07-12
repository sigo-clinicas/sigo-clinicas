-- =============================================================================
-- 0700 FINANCEIRO — categorias, centros de custo, contas bancárias,
-- lançamentos (pagar/receber com pagamentos parciais normalizados em
-- baixa_lancamento), movimentação de conta (SEMPRE gerada transacionalmente
-- por RPC — correção por design do bug de conciliação A6) e comissões.
--
-- Acesso restrito a proprietário/gerente (matriz do legado: Financeiros só
-- admin/proprietario/gerente). Aba "Cobranças" NÃO é portada (decisão M5).
--
-- RPCs transacionais (Sprint 3 — assinatura já reservada aqui):
--   vender_orcamento(orcamento_id, parcelas jsonb)  → venda + pagamento[] + lancamentos
--   registrar_baixa_lancamento(lancamento_id, conta_id, valor, data, forma, obs)
--     → insere baixa_lancamento + movimentacao_conta e atualiza status/valor_pago
--       NA MESMA TRANSAÇÃO (nunca via INSERTs diretos do cliente).
-- =============================================================================

create table public.categoria_lancamento (
  id         uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinica (id) on delete cascade,
  nome       text not null,
  tipo       public.tipo_lancamento not null,
  descricao  text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, nome, tipo)
);

create table public.centro_custo (
  id         uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinica (id) on delete cascade,
  nome       text not null,
  descricao  text,
  cor        text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, nome)
);

create table public.conta_bancaria (
  id            uuid primary key default gen_random_uuid(),
  clinica_id    uuid not null references public.clinica (id) on delete cascade,
  nome          text not null,
  tipo          public.tipo_conta_bancaria not null default 'conta_corrente',
  banco         text,
  agencia       text,
  numero_conta  text,
  saldo_inicial numeric(14,2) not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (clinica_id, nome)
);

create table public.lancamento_financeiro (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinica (id) on delete cascade,
  tipo            public.tipo_lancamento not null,
  descricao       text not null,
  valor           numeric(12,2) not null check (valor >= 0),
  valor_pago      numeric(12,2) not null default 0, -- mantido pela RPC de baixa
  data_vencimento date not null,
  data_pagamento  date,                              -- data da quitação total
  status          public.status_lancamento not null default 'pendente',
  categoria_id    uuid references public.categoria_lancamento (id) on delete set null,
  centro_custo_id uuid references public.centro_custo (id) on delete set null,
  forma_pagamento public.forma_pagamento,
  consulta_id     uuid references public.consulta (id) on delete set null,
  venda_id        uuid references public.venda (id) on delete set null,
  profissional_id uuid references public.profissional (id) on delete set null,
  convenio_id     uuid references public.convenio (id) on delete set null,
  paciente_id     uuid references public.paciente (id) on delete set null,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_lancamento_clinica_venc
  on public.lancamento_financeiro (clinica_id, data_vencimento);
create index idx_lancamento_clinica_status
  on public.lancamento_financeiro (clinica_id, status);

-- Parcela da venda → lançamento de contas a receber gerado
alter table public.pagamento
  add column lancamento_id uuid
    references public.lancamento_financeiro (id) on delete set null;

-- Baixas (pagamentos parciais do Base44, normalizados). Inseridas SOMENTE
-- pela RPC registrar_baixa_lancamento.
create table public.baixa_lancamento (
  id                    uuid primary key default gen_random_uuid(),
  clinica_id            uuid not null references public.clinica (id) on delete cascade,
  lancamento_id         uuid not null references public.lancamento_financeiro (id) on delete cascade,
  conta_bancaria_id     uuid not null references public.conta_bancaria (id),
  data                  date not null default current_date,
  valor                 numeric(12,2) not null check (valor > 0),
  forma_pagamento       public.forma_pagamento,
  observacao            text,
  movimentacao_conta_id uuid, -- FK adicionada após criar movimentacao_conta
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Extrato da conta. Gerado transacionalmente junto com cada baixa (A6);
-- `conciliada` é o flag da conciliação manual.
create table public.movimentacao_conta (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null references public.clinica (id) on delete cascade,
  conta_bancaria_id uuid not null references public.conta_bancaria (id),
  lancamento_id     uuid references public.lancamento_financeiro (id) on delete set null,
  tipo              public.tipo_movimentacao_conta not null,
  descricao         text,
  valor             numeric(12,2) not null check (valor > 0),
  data              date not null default current_date,
  conciliada        boolean not null default false,
  observacao        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_movimentacao_conta
  on public.movimentacao_conta (conta_bancaria_id, data);

alter table public.baixa_lancamento
  add constraint baixa_lancamento_movimentacao_fk
  foreign key (movimentacao_conta_id)
  references public.movimentacao_conta (id) on delete set null;

-- Saldo por conta calculado do extrato (nada de saldo denormalizado — A3/A6).
-- security_invoker: a view respeita o RLS de quem consulta.
create view public.saldo_conta_bancaria
  with (security_invoker = on) as
select
  cb.id as conta_bancaria_id,
  cb.clinica_id,
  cb.nome,
  cb.saldo_inicial
    + coalesce(sum(case mc.tipo when 'entrada' then mc.valor else -mc.valor end), 0)
    as saldo_atual
from public.conta_bancaria cb
left join public.movimentacao_conta mc on mc.conta_bancaria_id = cb.id
group by cb.id;

-- Comissão apurada por execução (D3.4). Vira contas a pagar via lancamento_id.
create table public.comissao (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null references public.clinica (id) on delete cascade,
  profissional_id   uuid not null references public.profissional (id),
  item_orcamento_id uuid references public.item_orcamento (id) on delete set null,
  consulta_id       uuid references public.consulta (id) on delete set null,
  venda_id          uuid references public.venda (id) on delete set null,
  tipo_comissao     public.tipo_comissao not null,
  base_calculo      numeric(12,2),
  valor             numeric(12,2) not null,
  status            public.status_comissao not null default 'pendente',
  lancamento_id     uuid references public.lancamento_financeiro (id) on delete set null,
  observacoes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- RLS — financeiro só proprietário/gerente (leitura E escrita).
-- p_select_membro=false remove o SELECT amplo; policies manuais abaixo.
-- -----------------------------------------------------------------------------
call app.aplicar_padrao_tenant('categoria_lancamento', array['proprietario','gerente'], null, false);
call app.aplicar_padrao_tenant('centro_custo',         array['proprietario','gerente'], null, false);
call app.aplicar_padrao_tenant('conta_bancaria',       array['proprietario','gerente'], null, false);
call app.aplicar_padrao_tenant('lancamento_financeiro',array['proprietario','gerente'], null, false);

create policy categoria_lancamento_select on public.categoria_lancamento
  for select to authenticated
  using (app.tem_papel(clinica_id, array['proprietario','gerente']));
create policy centro_custo_select on public.centro_custo
  for select to authenticated
  using (app.tem_papel(clinica_id, array['proprietario','gerente']));
create policy conta_bancaria_select on public.conta_bancaria
  for select to authenticated
  using (app.tem_papel(clinica_id, array['proprietario','gerente']));
create policy lancamento_select on public.lancamento_financeiro
  for select to authenticated
  using (app.tem_papel(clinica_id, array['proprietario','gerente']));

-- Baixas e movimentações: leitura para proprietário/gerente; INSERT/DELETE
-- não têm policy (apenas RPC/service_role — integridade transacional A6).
-- UPDATE em movimentacao_conta limitado ao fluxo de conciliação manual.
alter table public.baixa_lancamento   enable row level security;
alter table public.movimentacao_conta enable row level security;
alter table public.comissao           enable row level security;

create trigger trg_updated_at before update on public.baixa_lancamento
  for each row execute function app.set_updated_at();
create trigger trg_updated_at before update on public.movimentacao_conta
  for each row execute function app.set_updated_at();
create trigger trg_updated_at before update on public.comissao
  for each row execute function app.set_updated_at();

create policy baixa_select on public.baixa_lancamento
  for select to authenticated
  using (app.tem_papel(clinica_id, array['proprietario','gerente']));

create policy movimentacao_select on public.movimentacao_conta
  for select to authenticated
  using (app.tem_papel(clinica_id, array['proprietario','gerente']));

create policy movimentacao_conciliar on public.movimentacao_conta
  for update to authenticated
  using (app.tem_papel(clinica_id, array['proprietario','gerente']))
  with check (app.tem_papel(clinica_id, array['proprietario','gerente']));

-- Comissões: proprietário/gerente gerenciam; profissional vê as suas.
create policy comissao_gestao on public.comissao
  for all to authenticated
  using (app.tem_papel(clinica_id, array['proprietario','gerente']))
  with check (app.tem_papel(clinica_id, array['proprietario','gerente']));

create policy comissao_select_profissional on public.comissao
  for select to authenticated
  using (exists (
    select 1 from public.profissional p
    where p.id = profissional_id and p.user_id = auth.uid()
  ));
