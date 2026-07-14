-- =============================================================================
-- S4-5 — CONVÊNIOS: fechamento de guia (buffer negociável da Fase 1).
-- Dois RPCs transacionais, gate proprietário/gerente (matriz financeira):
--   gerar_recebiveis_convenio  → cria contas a RECEBER (uma por consulta
--     concluída do convênio no período), idempotente por consulta+convênio
--     (dedup NOT EXISTS — reprocessar o período não duplica guia).
--   registrar_baixa_lote_convenio → dá baixa em N lançamentos numa única
--     transação, REUSANDO registrar_baixa_lancamento (S3-3) por item — cada
--     item gera movimentacao_conta e revalida tenant+saldo. Atômico: se uma
--     guia falha, o fechamento inteiro reverte.
-- Correção herdada do S3: a movimentação NASCE na RPC, nunca por INSERT de UI;
-- o saldo continua derivado da view saldo_conta_bancaria.
-- =============================================================================

-- Gerar recebíveis de um convênio para o período ------------------------------
create or replace function public.gerar_recebiveis_convenio(
  p_clinica_id  uuid,
  p_convenio_id uuid,
  p_ini         date,
  p_fim         date,
  p_categoria_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_criados int;
  v_total   numeric(12,2);
begin
  if not app.tem_papel(p_clinica_id, array['proprietario','gerente']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.convenio
    where id = p_convenio_id and clinica_id = p_clinica_id
  ) then
    raise exception 'convenio de outra clinica' using errcode = '23514';
  end if;
  if p_categoria_id is not null and not exists (
    select 1 from public.categoria_lancamento
    where id = p_categoria_id and clinica_id = p_clinica_id
  ) then
    raise exception 'categoria de outra clinica' using errcode = '23514';
  end if;

  with ins as (
    insert into public.lancamento_financeiro
      (clinica_id, tipo, descricao, valor, data_vencimento, status,
       categoria_id, consulta_id, convenio_id, profissional_id, paciente_id)
    select
      c.clinica_id,
      'receita',
      'Guia ' || coalesce(nullif(c.numero_guia, ''), 's/nº')
        || ' — ' || coalesce(p.nome, 'paciente'),
      c.valor,
      (c.data_hora::date + coalesce(cv.prazo_pagamento_dias, 30)),
      'pendente',
      p_categoria_id,
      c.id,
      c.convenio_id,
      c.profissional_id,
      c.paciente_id
    from public.consulta c
    join public.convenio cv on cv.id = c.convenio_id
    left join public.paciente p on p.id = c.paciente_id
    where c.clinica_id = p_clinica_id
      and c.convenio_id = p_convenio_id
      and c.status = 'concluido'
      and c.data_hora::date between p_ini and p_fim
      and coalesce(c.valor, 0) > 0
      and not exists (
        select 1 from public.lancamento_financeiro l
        where l.consulta_id = c.id and l.convenio_id = c.convenio_id
      )
    returning valor
  )
  select count(*), coalesce(sum(valor), 0) into v_criados, v_total from ins;

  return jsonb_build_object('criados', v_criados, 'total', v_total);
end;
$$;

revoke execute on function public.gerar_recebiveis_convenio(uuid, uuid, date, date, uuid) from public, anon;
grant  execute on function public.gerar_recebiveis_convenio(uuid, uuid, date, date, uuid) to authenticated;

-- Baixa em lote (fechamento) --------------------------------------------------
create or replace function public.registrar_baixa_lote_convenio(
  p_clinica_id uuid,
  p_conta_id   uuid,
  p_forma      public.forma_pagamento,
  p_data       date,
  p_itens      jsonb  -- [{ "lancamento_id": uuid, "valor": numeric }, ...]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item     jsonb;
  v_lanc     uuid;
  v_valor    numeric(12,2);
  v_baixados int := 0;
  v_total    numeric(12,2) := 0;
begin
  if not app.tem_papel(p_clinica_id, array['proprietario','gerente']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if jsonb_typeof(p_itens) <> 'array' then
    raise exception 'itens deve ser um array' using errcode = '23514';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_lanc  := nullif(v_item ->> 'lancamento_id', '')::uuid;
    v_valor := (v_item ->> 'valor')::numeric;
    if v_lanc is null or v_valor is null or v_valor <= 0 then
      raise exception 'item de baixa invalido' using errcode = '23514';
    end if;
    -- reusa a baixa transacional do S3 (valida tenant+saldo, gera extrato)
    perform public.registrar_baixa_lancamento(
      p_clinica_id, v_lanc, p_conta_id, v_valor, p_data, p_forma,
      'Fechamento de guia (convênio)');
    v_baixados := v_baixados + 1;
    v_total    := v_total + v_valor;
  end loop;

  return jsonb_build_object('baixados', v_baixados, 'total', v_total);
end;
$$;

revoke execute on function public.registrar_baixa_lote_convenio(uuid, uuid, public.forma_pagamento, date, jsonb) from public, anon;
grant  execute on function public.registrar_baixa_lote_convenio(uuid, uuid, public.forma_pagamento, date, jsonb) to authenticated;
