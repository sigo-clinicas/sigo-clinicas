-- =============================================================================
-- S3-3 — Financeiro núcleo: BAIXA transacional (corrige A6) + estorno.
-- A movimentacao_conta NASCE só aqui (RPC), nunca por INSERT de UI. O saldo é
-- derivado da view saldo_conta_bancaria. Correções vs Base44 (FecharContaModal):
--   (a) baixa + movimentacao numa única transação;
--   (b) DESPESA também gera saída no extrato (o Base44 só fazia receita).
-- Delta: categoria_lancamento hierárquica (pai_id/ordem) — porta Base44
-- CategoriasLista (subcategorias + reorder).
-- =============================================================================

-- Delta: categorias hierárquicas + ordenáveis --------------------------------
alter table public.categoria_lancamento
  add column pai_id uuid references public.categoria_lancamento (id) on delete set null,
  add column ordem  int not null default 0;

-- RPC: registrar baixa (parcial ou total) de um lançamento --------------------
create or replace function public.registrar_baixa_lancamento(
  p_clinica_id    uuid,
  p_lancamento_id uuid,
  p_conta_id      uuid,
  p_valor         numeric,
  p_data          date,
  p_forma         public.forma_pagamento,
  p_obs           text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_baixa_id    uuid;
  v_mov_id      uuid;
  v_tipo        public.tipo_lancamento;
  v_valor       numeric(12,2);
  v_valor_pago  numeric(12,2);
  v_restante    numeric(12,2);
  v_novo_pago   numeric(12,2);
  v_novo_status public.status_lancamento;
begin
  if not app.tem_papel(p_clinica_id, array['proprietario','gerente']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'valor da baixa deve ser positivo' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_lancamento_id::text, 0));

  select tipo, valor, valor_pago
    into v_tipo, v_valor, v_valor_pago
  from public.lancamento_financeiro
  where id = p_lancamento_id and clinica_id = p_clinica_id;
  if not found then
    raise exception 'lancamento nao encontrado na clinica' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.conta_bancaria
    where id = p_conta_id and clinica_id = p_clinica_id
  ) then
    raise exception 'conta bancaria de outra clinica' using errcode = '23514';
  end if;

  v_restante := v_valor - v_valor_pago;
  if p_valor > v_restante + 0.001 then
    raise exception 'baixa (%) excede o saldo em aberto (%)', p_valor, v_restante
      using errcode = '23514';
  end if;

  -- extrato: receita → entrada, despesa → saída (corrige A6)
  insert into public.movimentacao_conta
    (clinica_id, conta_bancaria_id, lancamento_id, tipo, descricao, valor, data)
  values
    (p_clinica_id, p_conta_id, p_lancamento_id,
     (case v_tipo when 'receita' then 'entrada' else 'saida' end)::public.tipo_movimentacao_conta,
     'Baixa de lançamento', p_valor, p_data)
  returning id into v_mov_id;

  insert into public.baixa_lancamento
    (clinica_id, lancamento_id, conta_bancaria_id, data, valor, forma_pagamento,
     observacao, movimentacao_conta_id)
  values
    (p_clinica_id, p_lancamento_id, p_conta_id, p_data, p_valor, p_forma,
     nullif(p_obs, ''), v_mov_id)
  returning id into v_baixa_id;

  v_novo_pago   := v_valor_pago + p_valor;
  v_novo_status := case when v_novo_pago >= v_valor then 'pago' else 'pago_parcial' end;
  update public.lancamento_financeiro set
    valor_pago     = v_novo_pago,
    status         = v_novo_status,
    data_pagamento = case when v_novo_pago >= v_valor then p_data else data_pagamento end
  where id = p_lancamento_id;

  -- se o lançamento é uma parcela de venda, reflete a quitação no pagamento
  if v_novo_pago >= v_valor then
    update public.pagamento
      set pago = true, data_pagamento = p_data
    where lancamento_id = p_lancamento_id;
  end if;

  return v_baixa_id;
end;
$$;

revoke execute on function public.registrar_baixa_lancamento(uuid, uuid, uuid, numeric, date, public.forma_pagamento, text) from public;
grant execute on function public.registrar_baixa_lancamento(uuid, uuid, uuid, numeric, date, public.forma_pagamento, text) to authenticated;

-- RPC: estornar uma baixa (remove extrato + recomputa o lançamento) -----------
create or replace function public.estornar_baixa_lancamento(
  p_clinica_id uuid,
  p_baixa_id   uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lanc_id     uuid;
  v_mov_id      uuid;
  v_valor       numeric(12,2);
  v_novo_pago   numeric(12,2);
  v_novo_status public.status_lancamento;
begin
  if not app.tem_papel(p_clinica_id, array['proprietario','gerente']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  select lancamento_id, movimentacao_conta_id
    into v_lanc_id, v_mov_id
  from public.baixa_lancamento
  where id = p_baixa_id and clinica_id = p_clinica_id;
  if not found then
    raise exception 'baixa nao encontrada na clinica' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_lanc_id::text, 0));

  delete from public.baixa_lancamento where id = p_baixa_id;
  if v_mov_id is not null then
    delete from public.movimentacao_conta where id = v_mov_id and clinica_id = p_clinica_id;
  end if;

  select valor into v_valor
  from public.lancamento_financeiro
  where id = v_lanc_id and clinica_id = p_clinica_id;

  select coalesce(sum(valor), 0) into v_novo_pago
  from public.baixa_lancamento where lancamento_id = v_lanc_id;

  v_novo_status := case
    when v_novo_pago <= 0 then 'pendente'
    when v_novo_pago >= v_valor then 'pago'
    else 'pago_parcial'
  end;
  update public.lancamento_financeiro set
    valor_pago     = v_novo_pago,
    status         = v_novo_status,
    data_pagamento = case when v_novo_pago >= v_valor then data_pagamento else null end
  where id = v_lanc_id;

  update public.pagamento set
    pago = (v_novo_pago >= v_valor),
    data_pagamento = case when v_novo_pago >= v_valor then data_pagamento else null end
  where lancamento_id = v_lanc_id;
end;
$$;

revoke execute on function public.estornar_baixa_lancamento(uuid, uuid) from public;
grant execute on function public.estornar_baixa_lancamento(uuid, uuid) to authenticated;
