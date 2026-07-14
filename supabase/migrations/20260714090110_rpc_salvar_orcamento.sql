-- =============================================================================
-- S3-1 — RPC transacional salvar_orcamento(clinica, orcamento jsonb, itens jsonb)
-- Salva/atualiza um orçamento + substitui seus itens numa ÚNICA transação, com
-- os TOTAIS calculados no servidor (nunca confiar no cliente). Segue o padrão
-- rpc_saida_estoque: SECURITY DEFINER + search_path='' + app.tem_papel.
-- O trigger trg_paciente_da_clinica (S3-1) valida o vínculo paciente↔clínica; o
-- CHECK item_orcamento_origem garante exatamente 1 de servico_id/item_estoque_id.
-- =============================================================================

create or replace function public.salvar_orcamento(
  p_clinica_id uuid,
  p_orcamento  jsonb,   -- { id?, paciente_id, cliente_nome, cliente_telefone,
                        --   cliente_email, profissional_id, convenio_id,
                        --   tabela_preco_id, status, validade_dias,
                        --   tipo_desconto, desconto, observacoes, anotacoes_internas }
  p_itens      jsonb    -- [{ servico_id?, item_estoque_id?, quantidade,
                        --    valor_unitario, tipo_valor, regioes[], unidade?, observacao? }]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id            uuid;
  v_valor_total   numeric(12,2);
  v_valor_final   numeric(12,2);
  v_tipo_desconto public.tipo_desconto;
  v_desconto      numeric(12,2);
  v_paciente_id   uuid := nullif(p_orcamento->>'paciente_id','')::uuid;
begin
  if not app.tem_papel(p_clinica_id,
      array['proprietario','gerente','recepcionista','assistente','profissional']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  v_tipo_desconto := coalesce(nullif(p_orcamento->>'tipo_desconto',''), 'percentual')::public.tipo_desconto;
  v_desconto      := coalesce((p_orcamento->>'desconto')::numeric, 0);

  -- Subtotal a partir dos itens (gratuito = 0). Fonte da verdade dos totais.
  select coalesce(sum(
           case when (it->>'tipo_valor') = 'gratuito' then 0
                else round(coalesce((it->>'quantidade')::numeric, 1)
                         * coalesce((it->>'valor_unitario')::numeric, 0), 2)
           end), 0)
    into v_valor_total
  from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) as it;

  v_valor_final := greatest(0, round(v_valor_total -
      case when v_tipo_desconto = 'percentual' then v_valor_total * v_desconto / 100
           else v_desconto end, 2));

  if nullif(p_orcamento->>'id','') is not null then
    v_id := (p_orcamento->>'id')::uuid;
    update public.orcamento set
      paciente_id        = v_paciente_id,
      cliente_nome       = nullif(p_orcamento->>'cliente_nome',''),
      cliente_telefone   = nullif(p_orcamento->>'cliente_telefone',''),
      cliente_email      = nullif(p_orcamento->>'cliente_email',''),
      profissional_id    = nullif(p_orcamento->>'profissional_id','')::uuid,
      convenio_id        = nullif(p_orcamento->>'convenio_id','')::uuid,
      tabela_preco_id    = nullif(p_orcamento->>'tabela_preco_id','')::uuid,
      status             = coalesce(nullif(p_orcamento->>'status',''), 'rascunho')::public.status_orcamento,
      validade_dias      = coalesce((p_orcamento->>'validade_dias')::int, 30),
      valor_total        = v_valor_total,
      tipo_desconto      = v_tipo_desconto,
      desconto           = v_desconto,
      valor_final        = v_valor_final,
      observacoes        = nullif(p_orcamento->>'observacoes',''),
      anotacoes_internas = nullif(p_orcamento->>'anotacoes_internas','')
    where id = v_id and clinica_id = p_clinica_id;
    if not found then
      raise exception 'orcamento nao encontrado na clinica' using errcode = '23514';
    end if;
    delete from public.item_orcamento where orcamento_id = v_id;
  else
    insert into public.orcamento (
      clinica_id, paciente_id, cliente_nome, cliente_telefone, cliente_email,
      profissional_id, convenio_id, tabela_preco_id, status, validade_dias,
      valor_total, tipo_desconto, desconto, valor_final, observacoes, anotacoes_internas)
    values (
      p_clinica_id, v_paciente_id,
      nullif(p_orcamento->>'cliente_nome',''), nullif(p_orcamento->>'cliente_telefone',''),
      nullif(p_orcamento->>'cliente_email',''),
      nullif(p_orcamento->>'profissional_id','')::uuid,
      nullif(p_orcamento->>'convenio_id','')::uuid,
      nullif(p_orcamento->>'tabela_preco_id','')::uuid,
      coalesce(nullif(p_orcamento->>'status',''), 'rascunho')::public.status_orcamento,
      coalesce((p_orcamento->>'validade_dias')::int, 30),
      v_valor_total, v_tipo_desconto, v_desconto, v_valor_final,
      nullif(p_orcamento->>'observacoes',''), nullif(p_orcamento->>'anotacoes_internas',''))
    returning id into v_id;
  end if;

  insert into public.item_orcamento (
    clinica_id, orcamento_id, servico_id, item_estoque_id, quantidade,
    valor_unitario, valor_total, tipo_valor, regioes, unidade, observacao)
  select
    p_clinica_id, v_id,
    nullif(it->>'servico_id','')::uuid,
    nullif(it->>'item_estoque_id','')::uuid,
    coalesce((it->>'quantidade')::numeric, 1),
    case when (it->>'tipo_valor') = 'gratuito' then 0
         else coalesce((it->>'valor_unitario')::numeric, 0) end,
    case when (it->>'tipo_valor') = 'gratuito' then 0
         else round(coalesce((it->>'quantidade')::numeric, 1)
                  * coalesce((it->>'valor_unitario')::numeric, 0), 2) end,
    coalesce(nullif(it->>'tipo_valor',''), 'fixo')::public.tipo_valor_preco,
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(it->'regioes', '[]'::jsonb)) as x), '{}'),
    nullif(it->>'unidade',''),
    nullif(it->>'observacao','')
  from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) as it;

  return v_id;
end;
$$;

revoke execute on function public.salvar_orcamento(uuid, jsonb, jsonb) from public;
grant execute on function public.salvar_orcamento(uuid, jsonb, jsonb) to authenticated;
