-- =============================================================================
-- 0200 PLATAFORMA (global, sem clinica_id): admin de plataforma,
-- segmento → especialidade (cadastro dinâmico, decisão da call de 02/07),
-- planos de assinatura. Seed das 66 especialidades do legado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Admins de plataforma (papel global). Escrita apenas via service_role
-- (não há policy de escrita — RLS bloqueia authenticated/anon).
-- -----------------------------------------------------------------------------
create table public.admin_plataforma (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_plataforma enable row level security;

create policy admin_plataforma_select on public.admin_plataforma
  for select to authenticated
  using (user_id = auth.uid() or app.is_admin());

-- -----------------------------------------------------------------------------
-- Segmento (tipo de estabelecimento) → Especialidade (N:N com clínica e
-- profissional). Editáveis pelo admin da plataforma; leitura pública
-- (marketplace busca por especialidade).
-- -----------------------------------------------------------------------------
create table public.segmento (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.especialidade (
  id          uuid primary key default gen_random_uuid(),
  segmento_id uuid not null references public.segmento (id),
  nome        text not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (segmento_id, nome)
);

alter table public.segmento enable row level security;
alter table public.especialidade enable row level security;

create trigger trg_updated_at before update on public.segmento
  for each row execute function app.set_updated_at();
create trigger trg_updated_at before update on public.especialidade
  for each row execute function app.set_updated_at();

create policy segmento_select_publico on public.segmento
  for select to anon, authenticated
  using (ativo or app.is_admin());

create policy segmento_admin_all on public.segmento
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy especialidade_select_publico on public.especialidade
  for select to anon, authenticated
  using (ativo or app.is_admin());

create policy especialidade_admin_all on public.especialidade
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- -----------------------------------------------------------------------------
-- Planos de assinatura (catálogo global; landing exibe preços)
-- limites: { "gerente": 1, "recepcionista": 1, "profissional": 3, ... }
-- permissoes: { "financeiro": true, "relatorios": false, "marketing": false,
--               "estoque": false, "integracao_api": false, "multiplas_clinicas": false }
-- -----------------------------------------------------------------------------
create table public.plano_assinatura (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null unique,
  descricao    text,
  preco_mensal numeric(12,2) not null,
  limites      jsonb not null default '{}'::jsonb,
  permissoes   jsonb not null default '{}'::jsonb,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.plano_assinatura enable row level security;

create trigger trg_updated_at before update on public.plano_assinatura
  for each row execute function app.set_updated_at();

create policy plano_select_publico on public.plano_assinatura
  for select to anon, authenticated
  using (ativo or app.is_admin());

create policy plano_admin_all on public.plano_assinatura
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- -----------------------------------------------------------------------------
-- SEED: segmentos + 66 especialidades do legado (dump.sql, ids 1–66),
-- nomes higienizados (espaços/':' finais removidos). Mapeamento
-- especialidade→segmento é proposta inicial — admin edita via UI (decisão
-- homologada na call de 02/07).
-- -----------------------------------------------------------------------------
insert into public.segmento (nome) values
  ('Médica'), ('Estética'), ('Odontológica'), ('Terapias');

with seg as (select id, nome from public.segmento)
insert into public.especialidade (segmento_id, nome)
select (select id from seg where nome = e.segmento), e.nome_esp
from (values
  ('Terapias',     'Acupuntura'),
  ('Médica',       'Alergia e Imunologia'),
  ('Médica',       'Angiologia'),
  ('Médica',       'Oncologia'),
  ('Médica',       'Cardiologia'),
  ('Médica',       'Cirurgia Cardiovascular'),
  ('Médica',       'Cirurgia Geral'),
  ('Médica',       'Cirurgia Plástica'),
  ('Médica',       'Cirurgia Vascular'),
  ('Médica',       'Clínica Médica'),
  ('Médica',       'Coloproctologia'),
  ('Médica',       'Dermatologia'),
  ('Médica',       'Endocrinologia'),
  ('Médica',       'Endoscopia'),
  ('Estética',     'Estética e Saúde - Nutrição'),
  ('Estética',     'Estética e Saúde - Estética em geral'),
  ('Terapias',     'Fisioterapia - Fisioterapia em geral'),
  ('Terapias',     'Fisioterapia - Fisioterapia Gerontológica'),
  ('Terapias',     'Fisioterapia - Acupuntura'),
  ('Terapias',     'Fisioterapia - Fisioterapia Respiratória'),
  ('Terapias',     'Fisioterapia - Fisioterapia Desportiva'),
  ('Terapias',     'Fisioterapia - Fisioterapia na Reeducação Postural (RPG)'),
  ('Terapias',     'Fisioterapia - Fisioterapia Neurofuncional'),
  ('Terapias',     'Fisioterapia - Pilates'),
  ('Médica',       'Gastroenterologia'),
  ('Médica',       'Genética médica'),
  ('Médica',       'Geriatria'),
  ('Médica',       'Ginecologia e obstetrícia'),
  ('Médica',       'Hematologia e Hemoterapia'),
  ('Médica',       'Homeopatia'),
  ('Médica',       'Infectologia'),
  ('Médica',       'Mastologia'),
  ('Médica',       'Medicina do Trabalho'),
  ('Médica',       'Medicina do Tráfego'),
  ('Médica',       'Medicina Esportiva'),
  ('Médica',       'Medicina Física e Reabilitação'),
  ('Médica',       'Medicina Intensiva'),
  ('Médica',       'Medicina Legal e Perícia Médica'),
  ('Médica',       'Medicina Nuclear'),
  ('Médica',       'Medicina Preventiva e Social'),
  ('Médica',       'Nefrologia'),
  ('Médica',       'Neurocirurgia'),
  ('Médica',       'Neurologia'),
  ('Médica',       'Nutrologia'),
  ('Médica',       'Obstetrícia'),
  ('Odontológica', 'Odontologia - Ortodontia'),
  ('Odontológica', 'Odontologia - Odontopediatria'),
  ('Odontológica', 'Odontologia - Odontogeriatria'),
  ('Odontológica', 'Odontologia - Endodontia'),
  ('Odontológica', 'Odontologia - Periodontia'),
  ('Odontológica', 'Odontologia - Cirurgia'),
  ('Odontológica', 'Odontologia - Traumatologia Bucomaxilofacial'),
  ('Odontológica', 'Odontologia - Dentística'),
  ('Odontológica', 'Odontologia - Radiologia Odontológica'),
  ('Odontológica', 'Odontologia - Implantodontia'),
  ('Médica',       'Oftalmologia'),
  ('Médica',       'Ortopedia e Traumatologia'),
  ('Médica',       'Otorrinolaringologia'),
  ('Médica',       'Patologia Clínica/Medicina laboratorial'),
  ('Médica',       'Pediatria'),
  ('Médica',       'Pneumologia'),
  ('Médica',       'Psiquiatria'),
  ('Médica',       'Radiologia e Diagnóstico por Imagem'),
  ('Médica',       'Radioterapia'),
  ('Médica',       'Reumatologia'),
  ('Médica',       'Urologia')
) as e (segmento, nome_esp);
