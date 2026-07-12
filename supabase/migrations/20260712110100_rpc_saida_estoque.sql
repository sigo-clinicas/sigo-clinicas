-- =============================================================================
-- 2010 RPC registrar_saida_estoque (S2-1) — baixa de estoque com bloqueio de
-- saldo negativo e serialização contra corrida.
--
-- Por que RPC (e não Server Action): o Base44 só valida saldo no cliente
-- (TOCTOU — duas saídas concorrentes furam o bloqueio). A checagem tem de ser
-- ATÔMICA: advisory lock por (clinica_id, item_id) → soma do saldo pela
-- movimentação → insert da saída, tudo numa transação. Saldo é DERIVADO
-- (nunca coluna), então não há reversão manual (corrige A3/A6).
--
-- Entrada NÃO é RPC no S2: é Server Action com insert em lote (atômico) e
-- validação de requer_validade no servidor — só ADICIONA saldo, sem corrida.
-- A RPC transacional de entrada entra no S3, quando cruzar para o financeiro
-- (contas a pagar + parcelas). Decisão homologada: entrada não gera financeiro
-- no S2.
-- =============================================================================

create or replace function public.registrar_saida_estoque(
  p_clinica_id uuid,
  p_data       date,
  p_observacao text,
  p_linhas     jsonb  -- [{ "item_id": uuid, "quantidade": number }]
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha   jsonb;
  v_item_id uuid;
  v_qtd     numeric(12,3);
  v_saldo   numeric;
  v_count   int := 0;
begin
  -- Autorização: papel de escrita de estoque (matriz do legado)
  if not app.tem_papel(p_clinica_id, array['proprietario', 'gerente']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  for v_linha in select * from jsonb_array_elements(p_linhas)
  loop
    v_item_id := (v_linha ->> 'item_id')::uuid;
    v_qtd     := (v_linha ->> 'quantidade')::numeric;
    if v_item_id is null or v_qtd is null or v_qtd <= 0 then
      continue;
    end if;

    -- O item precisa pertencer à clínica alvo (isolamento de tenant)
    if not exists (
      select 1 from public.item_estoque ie
      where ie.id = v_item_id and ie.clinica_id = p_clinica_id
    ) then
      raise exception 'item % nao pertence a clinica %', v_item_id, p_clinica_id
        using errcode = '23514';
    end if;

    -- Serializa saídas concorrentes do MESMO item (fecha o TOCTOU)
    perform pg_advisory_xact_lock(
      hashtextextended(p_clinica_id::text || ':' || v_item_id::text, 0)
    );

    -- Saldo derivado: soma de entradas/saldo_inicial menos saídas
    select coalesce(sum(
      case me.tipo when 'saida' then -me.quantidade else me.quantidade end
    ), 0)
      into v_saldo
      from public.movimentacao_estoque me
     where me.item_id = v_item_id;

    if v_qtd > v_saldo then
      raise exception
        'saldo insuficiente para o item % (disponivel %, solicitado %)',
        v_item_id, v_saldo, v_qtd
        using errcode = '23514';
    end if;

    insert into public.movimentacao_estoque
      (clinica_id, item_id, tipo, quantidade, data, observacao)
    values
      (p_clinica_id, v_item_id, 'saida', v_qtd,
       coalesce(p_data, current_date), nullif(p_observacao, ''));

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.registrar_saida_estoque from anon;
grant execute on function public.registrar_saida_estoque to authenticated;
