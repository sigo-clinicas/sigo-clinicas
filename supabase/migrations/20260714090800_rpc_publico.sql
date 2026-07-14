-- =============================================================================
-- S3-8 — Agendamento público (marketplace). RPC transacional agendar_publico:
-- upsert paciente global + vínculo paciente_clinica (origem marketplace) +
-- consulta + consulta_servico, numa transação, com trava anti double-booking.
-- Chamada SÓ pelo Route Handler com service_role (revoke public; grant
-- service_role) — porta pública sem login, padrão anamnese-publica (A8/§2).
-- Elimina os hacks do Base44 (paciente_id:'externo', status:'externo').
-- =============================================================================

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
begin
  if coalesce(trim(p_nome), '') = '' or coalesce(trim(p_telefone), '') = '' then
    raise exception 'nome e telefone obrigatorios' using errcode = '23514';
  end if;

  -- clínica pública/ativa
  if not exists (
    select 1 from public.clinica
    where id = p_clinica_id and ativo and exibir_marketplace
  ) then
    raise exception 'clinica indisponivel' using errcode = '23514';
  end if;
  -- profissional ativo e da clínica
  if not exists (
    select 1 from public.profissional
    where id = p_profissional_id and clinica_id = p_clinica_id and ativo
  ) then
    raise exception 'profissional indisponivel' using errcode = '23514';
  end if;
  if p_data_hora < now() then
    raise exception 'horario no passado' using errcode = '23514';
  end if;

  -- trava anti double-booking (profissional + horário)
  perform pg_advisory_xact_lock(
    hashtextextended(p_profissional_id::text || ':' || p_data_hora::text, 0)
  );
  if exists (
    select 1 from public.consulta
    where profissional_id = p_profissional_id
      and data_hora = p_data_hora
      and status <> 'cancelado'
  ) then
    raise exception 'horario ja ocupado' using errcode = '23514';
  end if;

  -- upsert paciente global (dedup por CPF quando informado; senão cria)
  if coalesce(trim(p_cpf), '') <> '' then
    select id into v_paciente_id from public.paciente where cpf = p_cpf limit 1;
  end if;
  if v_paciente_id is null then
    insert into public.paciente (nome, cpf, telefone, email)
    values (p_nome, nullif(trim(p_cpf), ''), p_telefone, nullif(trim(p_email), ''))
    returning id into v_paciente_id;
  end if;

  -- vínculo com a clínica (origem marketplace) — antes da consulta (trigger)
  insert into public.paciente_clinica (clinica_id, paciente_id, origem)
  values (p_clinica_id, v_paciente_id, 'marketplace')
  on conflict do nothing;

  insert into public.consulta
    (clinica_id, paciente_id, profissional_id, data_hora, status, duracao_minutos, observacoes)
  values
    (p_clinica_id, v_paciente_id, p_profissional_id, p_data_hora, 'agendado', 30,
     nullif(trim(p_obs), ''))
  returning id into v_consulta_id;

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
