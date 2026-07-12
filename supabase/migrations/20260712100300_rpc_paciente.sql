-- =============================================================================
-- 1400 RPC transacional: cadastrar/atualizar paciente + vínculo (S1-7)
-- Paciente é GLOBAL e o vínculo é por tenant — criar os dois cruza a fronteira
-- global↔tenant e precisa de atomicidade (Opção B do CLAUDE.md §2). Além
-- disso, quem cria um paciente sem vínculo não consegue lê-lo de volta pelo
-- RLS (SELECT exige vínculo), então `insert().select()` do client falharia.
--
-- SECURITY DEFINER: roda como owner, mas VALIDA o papel do CHAMADOR via os
-- claims do JWT (auth.jwt()/app.tem_papel continuam refletindo o usuário da
-- requisição dentro da função). Faz o dedup global por CPF/e-mail.
-- =============================================================================

create or replace function public.salvar_paciente_clinica(
  p_clinica_id  uuid,
  p_paciente_id uuid  default null,       -- null = criar/deduplicar; preenchido = editar
  p_dados       jsonb default '{}'::jsonb, -- campos do cadastro global
  p_vinculo     jsonb default '{}'::jsonb  -- convenio_id, numero_carteirinha, origem
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paciente_id uuid := p_paciente_id;
  v_cpf   text := nullif(p_dados ->> 'cpf', '');
  v_email text := nullif(lower(p_dados ->> 'email'), '');
begin
  -- Autorização: papel de escrita do chamador NA clínica alvo (ou admin)
  if not app.tem_papel(p_clinica_id, array[
    'proprietario','gerente','recepcionista','assistente','profissional'
  ]) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  -- Dedup global (só ao criar): reaproveita paciente existente por CPF/e-mail
  if v_paciente_id is null and (v_cpf is not null or v_email is not null) then
    select id into v_paciente_id
    from public.paciente
    where (v_cpf is not null and cpf = v_cpf)
       or (v_email is not null and email = v_email)
    limit 1;
  end if;

  if v_paciente_id is null then
    insert into public.paciente (
      nome, cpf, data_nascimento, telefone, email, logradouro, sexo,
      nome_mae, contato_emergencia_nome, contato_emergencia_telefone,
      contato_emergencia_parentesco, observacoes, ativo
    ) values (
      p_dados ->> 'nome',
      v_cpf,
      nullif(p_dados ->> 'data_nascimento', '')::date,
      nullif(p_dados ->> 'telefone', ''),
      v_email,
      nullif(p_dados ->> 'logradouro', ''),
      nullif(p_dados ->> 'sexo', '')::public.sexo,
      nullif(p_dados ->> 'nome_mae', ''),
      nullif(p_dados ->> 'contato_emergencia_nome', ''),
      nullif(p_dados ->> 'contato_emergencia_telefone', ''),
      nullif(p_dados ->> 'contato_emergencia_parentesco', ''),
      nullif(p_dados ->> 'observacoes', ''),
      coalesce((p_dados ->> 'ativo')::boolean, true)
    )
    returning id into v_paciente_id;
  else
    update public.paciente set
      nome = p_dados ->> 'nome',
      cpf = v_cpf,
      data_nascimento = nullif(p_dados ->> 'data_nascimento', '')::date,
      telefone = nullif(p_dados ->> 'telefone', ''),
      email = v_email,
      logradouro = nullif(p_dados ->> 'logradouro', ''),
      sexo = nullif(p_dados ->> 'sexo', '')::public.sexo,
      nome_mae = nullif(p_dados ->> 'nome_mae', ''),
      contato_emergencia_nome = nullif(p_dados ->> 'contato_emergencia_nome', ''),
      contato_emergencia_telefone = nullif(p_dados ->> 'contato_emergencia_telefone', ''),
      contato_emergencia_parentesco = nullif(p_dados ->> 'contato_emergencia_parentesco', ''),
      observacoes = nullif(p_dados ->> 'observacoes', ''),
      ativo = coalesce((p_dados ->> 'ativo')::boolean, true)
    where id = v_paciente_id;
  end if;

  insert into public.paciente_clinica (
    clinica_id, paciente_id, convenio_id, numero_carteirinha, origem, ativo
  ) values (
    p_clinica_id,
    v_paciente_id,
    nullif(p_vinculo ->> 'convenio_id', '')::uuid,
    nullif(p_vinculo ->> 'numero_carteirinha', ''),
    nullif(p_vinculo ->> 'origem', ''),
    true
  )
  on conflict (clinica_id, paciente_id) do update set
    convenio_id = excluded.convenio_id,
    numero_carteirinha = excluded.numero_carteirinha,
    origem = excluded.origem,
    updated_at = now();

  return v_paciente_id;
end;
$$;

revoke execute on function public.salvar_paciente_clinica from anon;
grant execute on function public.salvar_paciente_clinica to authenticated;
