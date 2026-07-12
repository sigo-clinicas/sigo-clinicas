-- =============================================================================
-- S2-3 — Galeria de fotos avulsas + ponte controlada evolução→estoque + retorno
--
-- Três peças que a UI da evolução clínica precisa e que a RLS sozinha não
-- resolve, porque cruzam fronteiras de papel/tabela:
--
--  1. galeria_foto (D6): foto avulsa do prontuário (antes/depois, detalhe...),
--     além das fotos embutidas em avaliacao_clinica.fotos e evolucao_sessao.fotos.
--     Registro clínico → mesma trava de tenant (trigger paciente↔clínica) e
--     mesmo padrão de RLS das demais tabelas do prontuário.
--
--  2. baixar_insumos_evolucao (D4): o profissional registra os INSUMOS que usou
--     na sessão (evolucao_insumo), mas NÃO tem policy de escrita em
--     movimentacao_estoque (baixa é gestão de estoque). A baixa real é uma ponte
--     SECURITY DEFINER, idempotente (só processa insumo ainda sem movimentação),
--     que valida tenant dos dois lados e serializa por item (fecha TOCTOU de
--     saldo, igual à registrar_saida_estoque do S2-1).
--
--  3. criar_consulta_retorno (D5): profissional não insere em consulta pela RLS
--     (agenda é da recepção). O retorno sugerido na evolução vira consulta via
--     ponte definer, ainda sob o trigger paciente↔clínica.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. galeria_foto (D6)
-- -----------------------------------------------------------------------------
create table public.galeria_foto (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null references public.clinica(id) on delete cascade,
  paciente_id     uuid not null references public.paciente(id) on delete cascade,
  profissional_id uuid references public.profissional(id) on delete set null,
  path            text not null,
  categoria       text not null default 'outro'
                    check (categoria in ('antes','depois','evolucao','detalhe','outro')),
  origem          text not null default 'galeria',
  descricao       text,
  data            date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_galeria_foto_paciente
  on public.galeria_foto (clinica_id, paciente_id);

-- RLS: papéis clínicos escrevem; profissional NÃO deleta (registro clínico,
-- mesma filosofia da retention-lock — só gestão remove foto avulsa).
call app.aplicar_padrao_tenant('galeria_foto',
  array['proprietario','gerente','recepcionista','assistente','profissional'],
  array['proprietario','gerente','recepcionista','assistente']);

-- Trava de tenant do dado de saúde: a foto tem de ser de paciente da clínica.
create trigger trg_paciente_da_clinica
  before insert or update of paciente_id, clinica_id on public.galeria_foto
  for each row execute function app.garantir_paciente_da_clinica();

-- -----------------------------------------------------------------------------
-- 2. baixar_insumos_evolucao (D4) — ponte evolucao_insumo → movimentacao_estoque
-- -----------------------------------------------------------------------------
create or replace function public.baixar_insumos_evolucao(
  p_evolucao_id uuid
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica  uuid;
  v_insumo   record;
  v_qtd      numeric(12,3);
  v_saldo    numeric;
  v_mov      uuid;
  v_count    int := 0;
begin
  select clinica_id into v_clinica
    from public.evolucao_sessao
   where id = p_evolucao_id;
  if v_clinica is null then
    raise exception 'evolucao % inexistente', p_evolucao_id using errcode = '23503';
  end if;

  -- Autorização: papel clínico da MESMA clínica da evolução
  if not app.tem_papel(v_clinica, array[
       'proprietario','gerente','recepcionista','assistente','profissional']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  for v_insumo in
    select id, item_estoque_id, quantidade
      from public.evolucao_insumo
     where evolucao_id = p_evolucao_id
       and item_estoque_id is not null
       and movimentacao_estoque_id is null
  loop
    -- Item precisa ser da mesma clínica da evolução (isolamento de tenant)
    if not exists (
      select 1 from public.item_estoque ie
      where ie.id = v_insumo.item_estoque_id and ie.clinica_id = v_clinica
    ) then
      raise exception 'insumo aponta item % de outra clinica', v_insumo.item_estoque_id
        using errcode = '23514';
    end if;

    -- Parse do texto livre de quantidade ("2", "1,5", "2 ampolas"): pega o
    -- primeiro número; vírgula decimal vira ponto. Sem número → não dá para
    -- baixar; deixa o insumo sem movimentação (re-tentável depois).
    -- OBS: o primeiro parêntese TEM de envolver o número todo — substring(from)
    -- retorna só o 1º grupo capturado, não o match inteiro; o decimal fica em
    -- grupo não-capturante (?:...) para não "roubar" o retorno.
    v_qtd := nullif(
      replace(substring(v_insumo.quantidade from '([0-9]+(?:[.,][0-9]+)?)'), ',', '.'),
      ''
    )::numeric;
    if v_qtd is null or v_qtd <= 0 then
      continue;
    end if;

    -- Serializa saídas concorrentes do mesmo item (fecha o TOCTOU do saldo)
    perform pg_advisory_xact_lock(
      hashtextextended(v_clinica::text || ':' || v_insumo.item_estoque_id::text, 0)
    );

    select coalesce(sum(
      case me.tipo when 'saida' then -me.quantidade else me.quantidade end
    ), 0)
      into v_saldo
      from public.movimentacao_estoque me
     where me.item_id = v_insumo.item_estoque_id;

    if v_qtd > v_saldo then
      raise exception
        'saldo insuficiente para o item % (disponivel %, solicitado %)',
        v_insumo.item_estoque_id, v_saldo, v_qtd
        using errcode = '23514';
    end if;

    insert into public.movimentacao_estoque
      (clinica_id, item_id, tipo, quantidade, data, observacao)
    values
      (v_clinica, v_insumo.item_estoque_id, 'saida', v_qtd, current_date,
       'Baixa de insumo — evolução ' || p_evolucao_id)
    returning id into v_mov;

    update public.evolucao_insumo
       set movimentacao_estoque_id = v_mov
     where id = v_insumo.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- revoke de PUBLIC (não só anon): o grant default vai a PUBLIC, e anon ∈ PUBLIC.
-- Só authenticated executa; o guard interno app.tem_papel ainda gateia por papel.
revoke execute on function public.baixar_insumos_evolucao from public;
grant execute on function public.baixar_insumos_evolucao to authenticated;

-- -----------------------------------------------------------------------------
-- 2b. remover_insumo_evolucao — fecha o ciclo: remover insumo já baixado
--     reverte a movimentação de estoque (o saldo derivado volta sozinho).
-- -----------------------------------------------------------------------------
create or replace function public.remover_insumo_evolucao(
  p_insumo_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica uuid;
  v_item    uuid;
  v_mov     uuid;
begin
  select clinica_id, item_estoque_id, movimentacao_estoque_id
    into v_clinica, v_item, v_mov
    from public.evolucao_insumo
   where id = p_insumo_id;
  if v_clinica is null then
    raise exception 'insumo % inexistente', p_insumo_id using errcode = '23503';
  end if;

  if not app.tem_papel(v_clinica, array[
       'proprietario','gerente','recepcionista','assistente','profissional']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  if v_mov is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(v_clinica::text || ':' || v_item::text, 0)
    );
    -- Apaga a saída → saldo derivado recupera a quantidade automaticamente
    delete from public.movimentacao_estoque where id = v_mov;
  end if;

  delete from public.evolucao_insumo where id = p_insumo_id;
end;
$$;

revoke execute on function public.remover_insumo_evolucao from public;
grant execute on function public.remover_insumo_evolucao to authenticated;

-- -----------------------------------------------------------------------------
-- 3. criar_consulta_retorno (D5) — profissional sugere retorno; vira consulta
-- -----------------------------------------------------------------------------
create or replace function public.criar_consulta_retorno(
  p_evolucao_id     uuid,
  p_data_hora       timestamptz,
  p_duracao_minutos int default 30
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica     uuid;
  v_paciente    uuid;
  v_profissional uuid;
  v_consulta    uuid;
begin
  select clinica_id, paciente_id, profissional_id
    into v_clinica, v_paciente, v_profissional
    from public.evolucao_sessao
   where id = p_evolucao_id;
  if v_clinica is null then
    raise exception 'evolucao % inexistente', p_evolucao_id using errcode = '23503';
  end if;
  if v_profissional is null then
    raise exception 'evolucao sem profissional; nao da para agendar retorno'
      using errcode = '23514';
  end if;
  if p_data_hora is null then
    raise exception 'data_hora do retorno e obrigatoria' using errcode = '23514';
  end if;

  if not app.tem_papel(v_clinica, array[
       'proprietario','gerente','recepcionista','assistente','profissional']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  -- O trigger paciente↔clínica valida o vínculo no insert.
  insert into public.consulta
    (clinica_id, paciente_id, profissional_id, data_hora, duracao_minutos,
     tipo, status)
  values
    (v_clinica, v_paciente, v_profissional, p_data_hora,
     coalesce(p_duracao_minutos, 30), 'retorno', 'agendado')
  returning id into v_consulta;

  return v_consulta;
end;
$$;

revoke execute on function public.criar_consulta_retorno from public;
grant execute on function public.criar_consulta_retorno to authenticated;
