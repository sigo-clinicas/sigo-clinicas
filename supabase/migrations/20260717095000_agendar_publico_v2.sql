-- =============================================================================
-- S6 — Anti double-booking DE VERDADE + agendar_publico v2.
--
-- Antes: a "trava" era igualdade EXATA de instante e a consulta gravava
-- duracao_minutos = 30 literal (rpc_publico.sql). Uma consulta de 60min às 14:00
-- não bloqueava 14:30; e um POST forjado fora do expediente era aceito.
--
-- Agora:
--  1. Constraint EXCLUDE (btree_gist) barra QUALQUER sobreposição de intervalo
--     [data_hora, data_hora+duracao) do mesmo profissional (exceto cancelada).
--     Fecha de uma vez o overlap parcial E a corrida público×painel — o painel
--     (consultas.ts) fazia check-then-insert sem lock.
--  2. agendar_publico v2 grava a duração REAL (soma dos serviços — decisão:
--     SOMA; default 30), revalida a janela do profissional e o horário de
--     funcionamento da clínica na ESCRITA, e delega o overlap à constraint.
-- =============================================================================

create extension if not exists btree_gist;

-- `timestamptz + interval` é STABLE (depende do TimeZone p/ intervalos com
-- dias/meses), então não entra direto numa expressão de índice. Nosso intervalo
-- é só MINUTOS (TZ-independente), então encapsulamos numa função IMMUTABLE — é
-- correto e é o padrão para esse caso.
create or replace function public.consulta_periodo(p_inicio timestamptz, p_dur int)
returns tstzrange
language sql
immutable
parallel safe
as $$ select tstzrange(p_inicio, p_inicio + make_interval(mins => p_dur)) $$;

-- Remoto tem 0 pares sobrepostos (verificado); em CI a tabela nasce vazia.
alter table public.consulta
  add constraint consulta_sem_overlap_profissional
  exclude using gist (
    profissional_id with =,
    public.consulta_periodo(data_hora, duracao_minutos) with &&
  ) where (status <> 'cancelado');

create or replace function public.agendar_publico(
  p_clinica_id      uuid,
  p_profissional_id uuid,
  p_data_hora       timestamptz,
  p_servico_ids     uuid[],
  p_nome            text,
  p_telefone        text,
  p_email           text,
  p_cpf             text,
  p_obs             text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paciente_id uuid;
  v_consulta_id uuid;
  v_serv        uuid;
  v_dur         int;
  v_tz          text;
  v_local       timestamp;
  v_dow         int;
  v_min         int;
  v_dias        smallint[];
  v_hini        time;
  v_hfim        time;
  v_ini         int;
  v_fim         int;
begin
  if coalesce(trim(p_nome), '') = '' or coalesce(trim(p_telefone), '') = '' then
    raise exception 'nome e telefone obrigatorios' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.clinica
    where id = p_clinica_id and ativo and exibir_marketplace
  ) then
    raise exception 'clinica indisponivel' using errcode = '23514';
  end if;

  select p.dias_atendimento, p.horario_inicio, p.horario_fim
    into v_dias, v_hini, v_hfim
  from public.profissional p
  where p.id = p_profissional_id and p.clinica_id = p_clinica_id and p.ativo;
  if not found then
    raise exception 'profissional indisponivel' using errcode = '23514';
  end if;

  if p_data_hora < now() then
    raise exception 'horario no passado' using errcode = '23514';
  end if;

  -- duração REAL = soma das durações dos serviços (SOMA); default 30
  select coalesce(sum(s.duracao_minutos), 0) into v_dur
  from public.servico s
  where s.id = any (coalesce(p_servico_ids, array[]::uuid[]))
    and s.clinica_id = p_clinica_id;
  if v_dur is null or v_dur <= 0 then
    v_dur := 30;
  end if;

  -- horário de PAREDE (local) da clínica
  select coalesce(timezone, 'America/Sao_Paulo') into v_tz
  from public.clinica where id = p_clinica_id;
  v_local := p_data_hora at time zone v_tz;
  v_dow := extract(dow from v_local)::int;
  v_min := (extract(hour from v_local) * 60 + extract(minute from v_local))::int;

  -- revalida a janela do profissional SE definida (sem janela = aceita; não há
  -- "expediente" para estar fora)
  if cardinality(coalesce(v_dias, '{}')) > 0 or v_hini is not null or v_hfim is not null then
    if cardinality(coalesce(v_dias, '{}')) > 0 and not (v_dow = any (v_dias)) then
      raise exception 'fora da janela do profissional' using errcode = '23514';
    end if;
    v_ini := coalesce((extract(hour from v_hini) * 60 + extract(minute from v_hini))::int, 0);
    v_fim := coalesce((extract(hour from v_hfim) * 60 + extract(minute from v_hfim))::int, 1440);
    if v_min < v_ini or v_min + v_dur > v_fim then
      raise exception 'fora da janela do profissional' using errcode = '23514';
    end if;
  end if;

  -- revalida o horário de funcionamento da clínica SE definido (S5)
  if exists (select 1 from public.clinica_horario where clinica_id = p_clinica_id) then
    if not exists (
      select 1 from public.clinica_horario ch
      where ch.clinica_id = p_clinica_id
        and ch.dia_semana = v_dow
        and (extract(hour from ch.abertura) * 60 + extract(minute from ch.abertura)) <= v_min
        and (extract(hour from ch.fechamento) * 60 + extract(minute from ch.fechamento)) >= v_min + v_dur
    ) then
      raise exception 'fora do horario de funcionamento' using errcode = '23514';
    end if;
  end if;

  -- upsert paciente global (dedup por CPF)
  if coalesce(trim(p_cpf), '') <> '' then
    select id into v_paciente_id from public.paciente where cpf = p_cpf limit 1;
  end if;
  if v_paciente_id is null then
    insert into public.paciente (nome, cpf, telefone, email)
    values (p_nome, nullif(trim(p_cpf), ''), p_telefone, nullif(trim(p_email), ''))
    returning id into v_paciente_id;
  end if;

  insert into public.paciente_clinica (clinica_id, paciente_id, origem)
  values (p_clinica_id, v_paciente_id, 'marketplace')
  on conflict do nothing;

  -- overlap GARANTIDO pela constraint EXCLUDE; traduz o erro para a msg pública
  begin
    insert into public.consulta
      (clinica_id, paciente_id, profissional_id, data_hora, status, duracao_minutos, observacoes)
    values
      (p_clinica_id, v_paciente_id, p_profissional_id, p_data_hora, 'agendado', v_dur,
       nullif(trim(p_obs), ''))
    returning id into v_consulta_id;
  exception when exclusion_violation then
    raise exception 'horario ja ocupado' using errcode = '23514';
  end;

  if p_servico_ids is not null then
    foreach v_serv in array p_servico_ids loop
      insert into public.consulta_servico (clinica_id, consulta_id, servico_id)
      values (p_clinica_id, v_consulta_id, v_serv)
      on conflict do nothing;
    end loop;
  end if;

  return v_consulta_id;
end;
$$;

revoke execute on function public.agendar_publico(uuid, uuid, timestamptz, uuid[], text, text, text, text, text) from public;
grant execute on function public.agendar_publico(uuid, uuid, timestamptz, uuid[], text, text, text, text, text) to service_role;
