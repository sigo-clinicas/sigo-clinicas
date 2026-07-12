-- =============================================================================
-- 0900 PRONTUÁRIO — formulários de anamnese configuráveis + resposta com
-- token público (acesso SEM login somente via Edge Function com service role —
-- A8; NENHUMA policy anon aqui), avaliação clínica, evolução de sessão com
-- insumos rastreáveis (link real com estoque — M2/D2.4), documentos e
-- consentimentos.
--
-- fotos jsonb = [{ "path": "<clinica_id>/...", "descricao": "", "data": "" }]
-- apontando para o bucket privado `prontuario` (policies na migration 1100).
--
-- Escrita: papéis clínicos + recepção (matriz do legado: FichasAnamnese CRUD
-- para recepcionista/assistente; profissional escreve mas NÃO deleta).
-- =============================================================================

create table public.formulario_anamnese (
  id         uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinica (id) on delete cascade,
  nome       text not null,
  descricao  text,
  perguntas  jsonb not null default '[]'::jsonb,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, nome)
);

create table public.resposta_anamnese (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null references public.clinica (id) on delete cascade,
  paciente_id        uuid not null references public.paciente (id),
  formulario_id      uuid not null references public.formulario_anamnese (id),
  consulta_id        uuid references public.consulta (id) on delete set null,
  respostas          jsonb not null default '[]'::jsonb,
  status             public.status_anamnese not null default 'pendente',
  token              uuid not null unique default gen_random_uuid(),
  expira_em          timestamptz,
  data_preenchimento timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_resposta_anamnese_paciente
  on public.resposta_anamnese (paciente_id);

create table public.avaliacao_clinica (
  id                    uuid primary key default gen_random_uuid(),
  clinica_id            uuid not null references public.clinica (id) on delete cascade,
  paciente_id           uuid not null references public.paciente (id),
  profissional_id       uuid references public.profissional (id) on delete set null,
  data                  date not null default current_date,
  queixa_principal      text,
  historia_doenca_atual text,
  historico_familiar    text,
  revisao_sistemas      text,
  pressao_arterial      text,
  frequencia_cardiaca   text,
  peso                  numeric(6,2),
  altura                numeric(6,2),
  exame_especifico      text,
  resultados_exames     text,
  hipotese_diagnostica  text,
  plano_terapeutico     text,
  fotos                 jsonb not null default '[]'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_avaliacao_paciente on public.avaliacao_clinica (paciente_id);

create table public.evolucao_sessao (
  id                       uuid primary key default gen_random_uuid(),
  clinica_id               uuid not null references public.clinica (id) on delete cascade,
  paciente_id              uuid not null references public.paciente (id),
  profissional_id          uuid references public.profissional (id) on delete set null,
  consulta_id              uuid references public.consulta (id) on delete set null,
  orcamento_id             uuid references public.orcamento (id) on delete set null,
  data_hora                timestamptz not null default now(),
  descricao_atendimento    text,
  reacao_paciente          text,
  intercorrencias          text,
  orientacoes_pos          text,
  prescricao               text,
  numero_sessao            int,
  proxima_sessao_sugerida  date,
  fotos                    jsonb not null default '[]'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_evolucao_paciente on public.evolucao_sessao (paciente_id);

-- Insumos utilizados na sessão. produto_nome/fabricante/lote são SNAPSHOT
-- imutável (registro clínico congela o dado — não é a desnormalização A3);
-- item_estoque_id/movimentacao_estoque_id ligam à baixa real de estoque
-- (RPC baixar_insumos_evolucao, Sprint 2).
create table public.evolucao_insumo (
  id                       uuid primary key default gen_random_uuid(),
  clinica_id               uuid not null references public.clinica (id) on delete cascade,
  evolucao_id              uuid not null references public.evolucao_sessao (id) on delete cascade,
  item_estoque_id          uuid references public.item_estoque (id) on delete set null,
  movimentacao_estoque_id  uuid references public.movimentacao_estoque (id) on delete set null,
  produto_nome             text not null,
  fabricante               text,
  lote                     text,
  validade                 date,
  quantidade               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table public.documento_consentimento (
  id                   uuid primary key default gen_random_uuid(),
  clinica_id           uuid not null references public.clinica (id) on delete cascade,
  paciente_id          uuid not null references public.paciente (id),
  profissional_id      uuid references public.profissional (id) on delete set null,
  tipo                 public.tipo_documento not null,
  titulo               text not null,
  conteudo             text,
  arquivo_path         text,
  status               public.status_documento not null default 'pendente',
  data_assinatura      timestamptz,
  assinatura_path      text,
  ip_assinatura        inet,
  observacoes          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_documento_paciente
  on public.documento_consentimento (paciente_id);

-- RLS
call app.aplicar_padrao_tenant('formulario_anamnese',
  array['proprietario','gerente','recepcionista','assistente']);
call app.aplicar_padrao_tenant('resposta_anamnese',
  array['proprietario','gerente','recepcionista','assistente','profissional'],
  array['proprietario','gerente','recepcionista','assistente']);
call app.aplicar_padrao_tenant('avaliacao_clinica',
  array['proprietario','gerente','recepcionista','assistente','profissional'],
  array['proprietario','gerente','recepcionista','assistente']);
call app.aplicar_padrao_tenant('evolucao_sessao',
  array['proprietario','gerente','recepcionista','assistente','profissional'],
  array['proprietario','gerente','recepcionista','assistente']);
call app.aplicar_padrao_tenant('evolucao_insumo',
  array['proprietario','gerente','recepcionista','assistente','profissional'],
  array['proprietario','gerente','recepcionista','assistente']);
call app.aplicar_padrao_tenant('documento_consentimento',
  array['proprietario','gerente','recepcionista','assistente','profissional'],
  array['proprietario','gerente','recepcionista','assistente']);

-- Paciente logado vê a própria anamnese e os próprios documentos
create policy resposta_anamnese_select_paciente on public.resposta_anamnese
  for select to authenticated
  using (paciente_id = app.paciente_id());

create policy documento_select_paciente on public.documento_consentimento
  for select to authenticated
  using (paciente_id = app.paciente_id());
