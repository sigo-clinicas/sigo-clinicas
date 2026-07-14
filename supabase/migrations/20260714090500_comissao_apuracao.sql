-- =============================================================================
-- S3-5 — Comissões: apuração por profissional → contas a pagar (despesa).
-- Porta de reference/base44 Comissoes.jsx, corrigindo A3/A4: comissão por
-- EXECUÇÃO (consulta_servico/evolucao) com dedup por chave real (não substring
-- em observacoes), e geração transacional do lançamento.
-- Grão da comissão = consulta_servico (por_agendamento) — base lida de
-- clinica.config->>'base_comissao'. O valor/base de cada linha é calculado no
-- servidor (previaComissao) e a RPC apenas persiste + gera o lançamento.
-- =============================================================================

-- Delta: competência + fontes de dedup ----------------------------------------
alter table public.comissao
  add column competencia         date,
  add column consulta_servico_id uuid references public.consulta_servico (id) on delete set null,
  add column evolucao_sessao_id  uuid references public.evolucao_sessao (id) on delete set null;

-- Dedup por execução (uma comissão por consulta_servico / evolucao por prof)
create unique index uniq_comissao_consulta_servico
  on public.comissao (clinica_id, profissional_id, consulta_servico_id)
  where consulta_servico_id is not null;
create unique index uniq_comissao_evolucao
  on public.comissao (clinica_id, profissional_id, evolucao_sessao_id)
  where evolucao_sessao_id is not null;

-- RPC: apurar comissão (persiste comissões novas + gera 1 lançamento despesa) --
create or replace function public.apurar_comissao(
  p_clinica_id      uuid,
  p_profissional_id uuid,
  p_competencia     date,
  p_vencimento      date,
  p_categoria_id    uuid  default null,
  p_itens           jsonb default '[]'::jsonb  -- [{ consulta_servico_id?, evolucao_sessao_id?,
                                               --    consulta_id?, base_calculo?, tipo_comissao, valor }]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric(12,2);
  v_ids   uuid[];
  v_lanc  uuid;
begin
  if not app.tem_papel(p_clinica_id, array['proprietario','gerente']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profissional
    where id = p_profissional_id and clinica_id = p_clinica_id
  ) then
    raise exception 'profissional de outra clinica' using errcode = '23514';
  end if;

  -- Insere só as comissões AINDA não existentes (dedup por consulta_servico/evolucao)
  with novos as (
    insert into public.comissao (
      clinica_id, profissional_id, consulta_servico_id, evolucao_sessao_id,
      consulta_id, competencia, tipo_comissao, base_calculo, valor, status)
    select
      p_clinica_id, p_profissional_id,
      nullif(it->>'consulta_servico_id', '')::uuid,
      nullif(it->>'evolucao_sessao_id', '')::uuid,
      nullif(it->>'consulta_id', '')::uuid,
      p_competencia,
      (it->>'tipo_comissao')::public.tipo_comissao,
      nullif(it->>'base_calculo', '')::numeric,
      (it->>'valor')::numeric,
      'pendente'
    from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) as it
    where coalesce((it->>'valor')::numeric, 0) > 0
    on conflict do nothing
    returning id, valor
  )
  select coalesce(sum(valor), 0), coalesce(array_agg(id), '{}'::uuid[])
    into v_total, v_ids
  from novos;

  if array_length(v_ids, 1) is null or v_total <= 0 then
    raise exception 'nenhuma comissao nova para apurar (competencia ja apurada?)'
      using errcode = '23505';
  end if;

  insert into public.lancamento_financeiro (
    clinica_id, tipo, descricao, valor, data_vencimento, status,
    categoria_id, profissional_id, observacoes)
  values (
    p_clinica_id, 'despesa',
    'Comissão ' || to_char(p_competencia, 'MM/YYYY'),
    v_total, p_vencimento, 'pendente', p_categoria_id, p_profissional_id,
    'Apuração de comissão ' || to_char(p_competencia, 'MM/YYYY'))
  returning id into v_lanc;

  update public.comissao set lancamento_id = v_lanc where id = any(v_ids);
  return v_lanc;
end;
$$;

revoke execute on function public.apurar_comissao(uuid, uuid, date, date, uuid, jsonb) from public;
grant execute on function public.apurar_comissao(uuid, uuid, date, date, uuid, jsonb) to authenticated;

-- RPC: cancelar apuração (só se ainda não baixada) ----------------------------
create or replace function public.cancelar_apuracao_comissao(
  p_clinica_id    uuid,
  p_lancamento_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago numeric(12,2);
begin
  if not app.tem_papel(p_clinica_id, array['proprietario','gerente']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select valor_pago into v_pago
  from public.lancamento_financeiro
  where id = p_lancamento_id and clinica_id = p_clinica_id and tipo = 'despesa';
  if not found then
    raise exception 'lancamento de comissao nao encontrado' using errcode = '23514';
  end if;
  if v_pago > 0 then
    raise exception 'comissao ja possui baixa; estorne antes' using errcode = '23514';
  end if;
  update public.comissao
    set status = 'cancelada', lancamento_id = null
  where lancamento_id = p_lancamento_id and clinica_id = p_clinica_id;
  delete from public.lancamento_financeiro
  where id = p_lancamento_id and clinica_id = p_clinica_id;
end;
$$;

revoke execute on function public.cancelar_apuracao_comissao(uuid, uuid) from public;
grant execute on function public.cancelar_apuracao_comissao(uuid, uuid) to authenticated;

-- Trigger: baixa do lançamento de comissão → comissão 'paga' -------------------
create or replace function app.propagar_pagamento_comissao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pago' and old.status is distinct from new.status then
    update public.comissao
      set status = 'paga'
    where lancamento_id = new.id and status = 'pendente';
  end if;
  return new;
end;
$$;

create trigger trg_comissao_paga
  after update of status on public.lancamento_financeiro
  for each row execute function app.propagar_pagamento_comissao();
