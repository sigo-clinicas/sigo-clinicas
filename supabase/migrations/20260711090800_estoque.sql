-- =============================================================================
-- 0800 ESTOQUE (núcleo F1 — D2.4): itens, movimentações com lote/validade
-- (rastreabilidade exigida pelo prontuário M2) e composição de serviço.
-- Saldo é derivado das movimentações (view), nunca coluna denormalizada.
-- Baixa automática por evolução de prontuário será RPC transacional
-- (`baixar_insumos_evolucao`, Sprint 2). Estoque avançado (presets, mapa de
-- calor, bloqueio de saldo) = Fase 2.
-- =============================================================================

create table public.item_estoque (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinica (id) on delete cascade,
  codigo          text,
  descricao       text not null,
  classificacao   public.classificacao_item_estoque not null default 'outros',
  categoria       text,
  requer_validade boolean not null default false,
  unidade         text,
  preco_custo     numeric(12,2),
  preco_venda     numeric(12,2),
  para_venda      boolean not null default false,
  estoque_minimo  numeric(12,3) not null default 0,
  fornecedor      text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (clinica_id, descricao)
);

create table public.movimentacao_estoque (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinica (id) on delete cascade,
  item_id         uuid not null references public.item_estoque (id) on delete cascade,
  tipo            public.tipo_movimentacao_estoque not null,
  quantidade      numeric(12,3) not null check (quantidade > 0),
  preco_unitario  numeric(12,2),
  valor_total     numeric(12,2),
  data            date not null default current_date,
  fornecedor      text,
  lote            text,
  validade        date,
  centro_custo_id uuid references public.centro_custo (id) on delete set null,
  lancamento_id   uuid references public.lancamento_financeiro (id) on delete set null,
  observacao      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_mov_estoque_item on public.movimentacao_estoque (item_id, data);
create index idx_mov_estoque_lote on public.movimentacao_estoque (item_id, lote);

-- Saldo derivado (saldo_inicial e entrada somam; saida subtrai)
create view public.saldo_item_estoque
  with (security_invoker = on) as
select
  ie.id as item_id,
  ie.clinica_id,
  ie.descricao,
  ie.estoque_minimo,
  coalesce(sum(
    case me.tipo when 'saida' then -me.quantidade else me.quantidade end
  ), 0) as saldo_atual
from public.item_estoque ie
left join public.movimentacao_estoque me on me.item_id = ie.id
group by ie.id;

-- Composição do serviço (insumos consumidos por execução) — normalizada
-- (Base44 usava jsonb itens[]). Markup fica em servico.markup_percentual.
create table public.composicao_servico (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinica (id) on delete cascade,
  servico_id      uuid not null references public.servico (id) on delete cascade,
  item_estoque_id uuid not null references public.item_estoque (id) on delete cascade,
  quantidade      numeric(12,3) not null check (quantidade > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (servico_id, item_estoque_id)
);

-- RLS — cadastro/movimentação de estoque: proprietário/gerente (legado:
-- demais papéis só leitura).
call app.aplicar_padrao_tenant('item_estoque',         array['proprietario','gerente']);
call app.aplicar_padrao_tenant('movimentacao_estoque', array['proprietario','gerente']);
call app.aplicar_padrao_tenant('composicao_servico',   array['proprietario','gerente']);
