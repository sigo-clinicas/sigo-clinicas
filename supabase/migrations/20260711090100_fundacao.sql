-- =============================================================================
-- 0100 FUNDAÇÃO — extensões, schema utilitário `app`, enums de domínio,
-- helpers de claims JWT e gerador de policies RLS padrão por tenant.
--
-- Regra de ouro (CLAUDE.md §3/§5): toda tabela operacional tem `clinica_id`
-- e RLS habilitado DESDE A PRIMEIRA MIGRATION. As policies leem os claims
-- injetados pelo Custom Access Token Hook (migration 0300):
--   claims.clinicas        → jsonb { "<clinica_id>": "<papel>", ... }
--   claims.admin_plataforma → boolean (admin global da plataforma)
--   claims.paciente_id      → uuid do paciente vinculado ao usuário (se houver)
-- =============================================================================

create extension if not exists pgcrypto;

-- Schema utilitário: funções de apoio a RLS e triggers. Não é exposto pelo
-- PostgREST (só `public` é exposto), mas precisa de USAGE para as policies.
create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Enums de domínio (valores herdados do Base44/legado para paridade de UI)
-- -----------------------------------------------------------------------------
create type public.papel_clinica as enum
  ('proprietario', 'gerente', 'recepcionista', 'assistente', 'profissional');

create type public.tipo_clinica as enum
  ('medica', 'estetica', 'odontologica', 'terapias');

create type public.sexo as enum ('masculino', 'feminino', 'outro');

create type public.tipo_consulta as enum
  ('consulta', 'retorno', 'exame', 'procedimento');

create type public.status_consulta as enum
  ('agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'faltou');

create type public.tipo_intervalo as enum ('fixo', 'pontual');

create type public.tipo_convenio as enum
  ('plano_saude', 'particular', 'sus', 'outros');

create type public.tipo_valor_preco as enum ('fixo', 'a_partir_de', 'gratuito');

create type public.status_orcamento as enum
  ('rascunho', 'enviado', 'aprovado', 'recusado', 'expirado');

create type public.tipo_desconto as enum ('percentual', 'valor');

create type public.forma_pagamento as enum
  ('dinheiro', 'cartao_debito', 'cartao_credito', 'pix', 'transferencia',
   'boleto', 'convenio', 'outro');

create type public.tipo_lancamento as enum ('receita', 'despesa');

create type public.status_lancamento as enum
  ('pendente', 'pago_parcial', 'pago', 'cancelado', 'atrasado');

create type public.tipo_conta_bancaria as enum
  ('conta_corrente', 'cartao_credito', 'comissao', 'caixa', 'outro');

create type public.tipo_movimentacao_conta as enum ('entrada', 'saida');

create type public.tipo_comissao as enum ('percentual', 'valor_fixo');

create type public.status_comissao as enum ('pendente', 'paga', 'cancelada');

create type public.classificacao_item_estoque as enum
  ('material_consumo', 'medicamento', 'equipamento', 'limpeza', 'descartavel',
   'produto_venda', 'outros');

create type public.tipo_movimentacao_estoque as enum
  ('saldo_inicial', 'entrada', 'saida');

create type public.status_anamnese as enum ('pendente', 'preenchido');

create type public.tipo_documento as enum
  ('tcle', 'uso_imagem', 'atestado', 'solicitacao', 'declaracao', 'outro');

create type public.status_documento as enum ('pendente', 'assinado', 'recusado');

create type public.status_cupom as enum
  ('pendente', 'ativo', 'aceito', 'expirado', 'cancelado');

create type public.status_campanha as enum
  ('draft', 'agendada', 'ativa', 'pausada', 'finalizada');

create type public.status_depoimento as enum ('pendente', 'aprovado', 'recusado');

create type public.origem_depoimento as enum
  ('manual', 'solicitado', 'google', 'whatsapp');

create type public.status_sala_vip as enum ('pendente', 'aprovada', 'rejeitada');

create type public.origem_lead as enum ('cupom', 'lista_vip', 'marketplace');

create type public.status_lead as enum ('novo', 'publicado');

create type public.status_lead_sala_vip as enum
  ('novo', 'contatado', 'aprovado', 'recusado');

create type public.status_assinatura as enum ('ativa', 'pausada', 'cancelada');

-- -----------------------------------------------------------------------------
-- Helpers de claims (usados por TODAS as policies RLS)
-- -----------------------------------------------------------------------------

-- Mapa { clinica_id: papel } do usuário autenticado.
create or replace function app.clinicas()
returns jsonb
language sql stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'clinicas', '{}'::jsonb);
$$;

-- Admin de plataforma (papel global — cruza tenants).
create or replace function app.is_admin()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'admin_plataforma')::boolean, false);
$$;

-- Usuário pertence à clínica (qualquer papel)? Admin passa sempre.
create or replace function app.tem_clinica(cid uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select app.is_admin() or app.clinicas() ? cid::text;
$$;

-- Papel do usuário numa clínica (null se não pertence).
create or replace function app.papel(cid uuid)
returns text
language sql stable
set search_path = ''
as $$
  select app.clinicas() ->> cid::text;
$$;

-- Usuário tem um dos papéis na clínica? Admin passa sempre.
create or replace function app.tem_papel(cid uuid, papeis text[])
returns boolean
language sql stable
set search_path = ''
as $$
  select app.is_admin() or (app.clinicas() ->> cid::text) = any (papeis);
$$;

-- paciente_id do usuário logado (para policies "o paciente vê o que é dele").
create or replace function app.paciente_id()
returns uuid
language sql stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'paciente_id', '')::uuid;
$$;

grant execute on all functions in schema app to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Trigger updated_at
-- -----------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Gerador de RLS padrão para tabela tenant (coluna `clinica_id`).
-- Padrão: SELECT para qualquer membro da clínica; INSERT/UPDATE para os papéis
-- de escrita; DELETE para os papéis de delete (default = papéis de escrita).
-- Tabelas com regras diferentes (paciente global, financeiro restrito,
-- marketplace anônimo etc.) declaram policies manuais nas suas migrations.
-- Chamado apenas em migrations (roda como postgres).
-- -----------------------------------------------------------------------------
create or replace procedure app.aplicar_padrao_tenant(
  p_tabela        text,
  p_papeis_escrita text[],
  p_papeis_delete  text[] default null,
  p_select_membro  boolean default true
)
language plpgsql
as $$
declare
  v_delete text[] := coalesce(p_papeis_delete, p_papeis_escrita);
begin
  execute format('alter table public.%I enable row level security', p_tabela);

  execute format(
    'create trigger trg_updated_at before update on public.%I
       for each row execute function app.set_updated_at()', p_tabela);

  if p_select_membro then
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (app.tem_clinica(clinica_id))',
      p_tabela || '_select_membro', p_tabela);
  end if;

  execute format(
    'create policy %I on public.%I for insert to authenticated
       with check (app.tem_papel(clinica_id, %L::text[]))',
    p_tabela || '_insert', p_tabela, p_papeis_escrita);

  execute format(
    'create policy %I on public.%I for update to authenticated
       using (app.tem_papel(clinica_id, %L::text[]))
       with check (app.tem_papel(clinica_id, %L::text[]))',
    p_tabela || '_update', p_tabela, p_papeis_escrita, p_papeis_escrita);

  execute format(
    'create policy %I on public.%I for delete to authenticated
       using (app.tem_papel(clinica_id, %L::text[]))',
    p_tabela || '_delete', p_tabela, v_delete);
end;
$$;
