-- =============================================================================
-- S3-2 — RPC transacional vender_orcamento. Botão "Vender" do kanban
-- (reference/base44 VendaModal.jsx): de orçamento aprovado gera, numa ÚNICA
-- transação: venda (1) + pagamento[] (parcelas) + lancamento_financeiro[]
-- (contas a receber, receita/pendente) vinculados via pagamento.lancamento_id.
-- SECURITY DEFINER: cria os lançamentos financeiros mesmo o operador do funil
-- (recepção/assistente) não tendo escrita direta em financeiro (RLS restrita).
-- Guarda: orçamento aprovado, tenant, unicidade da venda, soma das parcelas.
-- =============================================================================

create or replace function public.vender_orcamento(
  p_clinica_id      uuid,
  p_orcamento_id    uuid,
  p_forma_pagamento public.forma_pagamento,
  p_data_venda      date,
  p_parcelas        jsonb   -- [{ numero:int, valor:numeric, vencimento:'YYYY-MM-DD' }]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venda_id    uuid;
  v_valor_final numeric(12,2);
  v_soma        numeric(12,2);
  v_status      public.status_orcamento;
  v_paciente_id uuid;
  v_nome        text;
  v_lanc_id     uuid;
  v_parcela     jsonb;
begin
  if not app.tem_papel(p_clinica_id,
      array['proprietario','gerente','recepcionista','assistente']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  -- serializa a venda deste orçamento (anti-corrida) + carrega o orçamento
  perform pg_advisory_xact_lock(hashtextextended(p_orcamento_id::text, 0));
  select valor_final, status, paciente_id, cliente_nome
    into v_valor_final, v_status, v_paciente_id, v_nome
  from public.orcamento
  where id = p_orcamento_id and clinica_id = p_clinica_id;
  if not found then
    raise exception 'orcamento nao encontrado na clinica' using errcode = '23514';
  end if;
  if v_status <> 'aprovado' then
    raise exception 'orcamento nao esta aprovado (%)', v_status using errcode = '23514';
  end if;

  -- parcelas devem somar o valor_final (tolerância de arredondamento)
  select coalesce(sum((p->>'valor')::numeric), 0) into v_soma
  from jsonb_array_elements(coalesce(p_parcelas, '[]'::jsonb)) as p;
  if abs(v_soma - v_valor_final) > 0.01 then
    raise exception 'parcelas (%) nao somam o total (%)', v_soma, v_valor_final
      using errcode = '23514';
  end if;

  -- venda: unique(orcamento_id) garante 1 venda por orçamento (2ª tentativa → 23505)
  insert into public.venda (clinica_id, orcamento_id, data_hora, forma_pagamento)
  values (p_clinica_id, p_orcamento_id, p_data_venda::timestamptz, p_forma_pagamento)
  returning id into v_venda_id;

  if v_paciente_id is not null then
    select nome into v_nome from public.paciente where id = v_paciente_id;
  end if;

  for v_parcela in
    select * from jsonb_array_elements(coalesce(p_parcelas, '[]'::jsonb))
  loop
    insert into public.lancamento_financeiro
      (clinica_id, tipo, descricao, valor, data_vencimento, status,
       forma_pagamento, venda_id, paciente_id)
    values
      (p_clinica_id, 'receita',
       coalesce(nullif(v_nome, ''), 'Cliente') || ' - Parcela ' || (v_parcela->>'numero'),
       (v_parcela->>'valor')::numeric, (v_parcela->>'vencimento')::date, 'pendente',
       p_forma_pagamento, v_venda_id, v_paciente_id)
    returning id into v_lanc_id;

    insert into public.pagamento
      (clinica_id, venda_id, numero_parcela, valor, vencimento,
       forma_pagamento, lancamento_id)
    values
      (p_clinica_id, v_venda_id, (v_parcela->>'numero')::int,
       (v_parcela->>'valor')::numeric, (v_parcela->>'vencimento')::date,
       p_forma_pagamento, v_lanc_id);
  end loop;

  return v_venda_id;
end;
$$;

revoke execute on function public.vender_orcamento(uuid, uuid, public.forma_pagamento, date, jsonb) from public;
grant execute on function public.vender_orcamento(uuid, uuid, public.forma_pagamento, date, jsonb) to authenticated;
