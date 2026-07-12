-- =============================================================================
-- 1000 MARKETING + ASSINATURA — cupons, campanhas (segmentação F1; disparo
-- real = AD/Fase 2 — A5), depoimentos (com destaque/ranqueamento da landing),
-- Sala VIP, leads (captação pública nome+telefone SEM login — M3) e
-- assinatura da clínica.
-- =============================================================================

create table public.cupom (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinica (id) on delete cascade,
  codigo          text not null,
  tipo_desconto   public.tipo_desconto not null default 'percentual',
  valor_desconto  numeric(12,2) not null,
  descricao       text,
  status          public.status_cupom not null default 'pendente',
  validade_inicio date,
  validade_fim    date,
  regras_uso      text,
  quantidade_usos int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (clinica_id, codigo)
);

-- filtros: { demograficos: {...}, procedimentos: {...}, status_paciente: {...},
--            compra: {...}, temporais: {...} }  (estrutura do Base44)
-- conteudo: { email: {assunto, corpo}, sms: {mensagem}, whatsapp: {mensagem} }
create table public.campanha (
  id                       uuid primary key default gen_random_uuid(),
  clinica_id               uuid not null references public.clinica (id) on delete cascade,
  nome                     text not null,
  status                   public.status_campanha not null default 'draft',
  descricao                text,
  filtros                  jsonb not null default '{}'::jsonb,
  canais                   text[] not null default '{}'
    check (canais <@ array['email','sms','whatsapp']),
  conteudo                 jsonb not null default '{}'::jsonb,
  data_agendado            timestamptz,
  data_envio               timestamptz,
  quantidade_destinatarios int not null default 0,
  quantidade_enviados      int not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- paciente_id opcional: depoimentos importados (Google etc.) não têm cadastro.
create table public.depoimento (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null references public.clinica (id) on delete cascade,
  paciente_id       uuid references public.paciente (id) on delete set null,
  paciente_nome     text not null,
  profissional_id   uuid references public.profissional (id) on delete set null,
  servico_id        uuid references public.servico (id) on delete set null,
  texto             text not null,
  nota              smallint check (nota between 1 and 5),
  foto_path         text,
  status            public.status_depoimento not null default 'pendente',
  publicar_no_site  boolean not null default false,
  destaque          boolean not null default false,
  origem            public.origem_depoimento not null default 'manual',
  token_solicitacao uuid unique default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.sala_vip (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null references public.clinica (id) on delete cascade,
  nome             text not null,
  descricao        text,
  beneficios       text,
  quantidade_vagas int not null default 100,
  status           public.status_sala_vip not null default 'pendente',
  ativa            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Lead da plataforma: nasce sem clínica (captação global) e é publicado para
-- uma clínica pelo admin (fluxo Base44 admin/Leads).
create table public.lead (
  id         uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinica (id) on delete set null,
  nome       text not null,
  telefone   text not null,
  origem     public.origem_lead not null default 'marketplace',
  cupom_id   uuid references public.cupom (id) on delete set null,
  user_id    uuid references auth.users (id) on delete set null,
  status     public.status_lead not null default 'novo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_sala_vip (
  id             uuid primary key default gen_random_uuid(),
  clinica_id     uuid not null references public.clinica (id) on delete cascade,
  sala_vip_id    uuid not null references public.sala_vip (id) on delete cascade,
  nome           text not null,
  telefone       text not null,
  email          text,
  status         public.status_lead_sala_vip not null default 'novo',
  data_interesse timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.assinatura_clinica (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null unique references public.clinica (id) on delete cascade,
  plano_id          uuid not null references public.plano_assinatura (id),
  preco_mensal      numeric(12,2),
  status            public.status_assinatura not null default 'ativa',
  data_inicio       date not null default current_date,
  proxima_cobranca  date,
  data_cancelamento date,
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
call app.aplicar_padrao_tenant('cupom',         array['proprietario','gerente']);
call app.aplicar_padrao_tenant('campanha',      array['proprietario','gerente']);
call app.aplicar_padrao_tenant('depoimento',    array['proprietario','gerente']);
call app.aplicar_padrao_tenant('sala_vip',      array['proprietario','gerente']);
call app.aplicar_padrao_tenant('lead_sala_vip', array['proprietario','gerente']);

-- Marketplace público: cupons ativos e depoimentos aprovados/publicados das
-- clínicas visíveis; salas VIP aprovadas.
create policy cupom_select_marketplace on public.cupom
  for select to anon, authenticated
  using (
    status = 'ativo'
    and exists (select 1 from public.clinica c
                where c.id = clinica_id and c.ativo and c.exibir_marketplace)
  );

create policy depoimento_select_marketplace on public.depoimento
  for select to anon, authenticated
  using (
    status = 'aprovado' and publicar_no_site
    and exists (select 1 from public.clinica c
                where c.id = clinica_id and c.ativo and c.exibir_marketplace)
  );

create policy sala_vip_select_marketplace on public.sala_vip
  for select to anon, authenticated
  using (
    status = 'aprovada' and ativa
    and exists (select 1 from public.clinica c
                where c.id = clinica_id and c.ativo and c.exibir_marketplace)
  );

-- Captação pública SEM login (M3): anon só INSERE lead novo; nunca lê.
create policy lead_insert_publico on public.lead
  for insert to anon, authenticated
  with check (status = 'novo');

create policy lead_sala_vip_insert_publico on public.lead_sala_vip
  for insert to anon, authenticated
  with check (status = 'novo');

-- Leads: admin gerencia o funil global; clínica vê/gerencia os publicados
-- para ela (lead tem clinica_id nullable → policies manuais).
alter table public.lead enable row level security;

create trigger trg_updated_at before update on public.lead
  for each row execute function app.set_updated_at();

create policy lead_admin_all on public.lead
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy lead_select_clinica on public.lead
  for select to authenticated
  using (clinica_id is not null
         and app.tem_papel(clinica_id, array['proprietario','gerente']));

create policy lead_update_clinica on public.lead
  for update to authenticated
  using (clinica_id is not null
         and app.tem_papel(clinica_id, array['proprietario','gerente']))
  with check (clinica_id is not null
         and app.tem_papel(clinica_id, array['proprietario','gerente']));

-- Assinatura: gestão pelo admin da plataforma; proprietário/gerente consultam.
alter table public.assinatura_clinica enable row level security;

create trigger trg_updated_at before update on public.assinatura_clinica
  for each row execute function app.set_updated_at();

create policy assinatura_admin_all on public.assinatura_clinica
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy assinatura_select_clinica on public.assinatura_clinica
  for select to authenticated
  using (app.tem_papel(clinica_id, array['proprietario','gerente']));
