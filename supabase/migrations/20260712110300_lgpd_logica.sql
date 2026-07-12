-- =============================================================================
-- S2-5 — LGPD: lógica de consentimento no fluxo + anonimização + self-service.
--
-- As COLUNAS de retenção/anonimização já vieram do S2-0 (baratas de landar cedo).
-- Aqui entra a LÓGICA (RPCs): o gate de consentimento que o fluxo consulta, a
-- anonimização irreversível (art. 16/18) e o pedido self-service do titular
-- (art. 18). A PURGA AUTOMÁTICA por prazo NÃO é implementada — os prazos (CFM
-- ~20 anos de prontuário, ~5 fiscais) dependem da cliente; ficam como colunas
-- configuráveis (clinica.retencao_*_meses) e um job futuro decide.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. consentimento_evento — trilha de accountability (art. 37): concessão,
--    revogação, exportação, exclusão e anonimização. Append-only (retido).
-- -----------------------------------------------------------------------------
create table public.consentimento_evento (
  id           uuid primary key default gen_random_uuid(),
  clinica_id   uuid not null references public.clinica(id) on delete cascade,
  paciente_id  uuid not null references public.paciente(id) on delete cascade,
  tipo         text not null
                 check (tipo in ('concessao','revogacao','exportacao','exclusao','anonimizacao')),
  documento_id uuid references public.documento_consentimento(id) on delete set null,
  origem       text not null default 'staff'
                 check (origem in ('staff','publico','self','admin')),
  detalhe      text,
  ip           inet,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_consentimento_evento_paciente
  on public.consentimento_evento (clinica_id, paciente_id);

-- Papéis clínicos registram concessão/revogação no atendimento; eventos são
-- retidos (accountability), então o DELETE é removido (retention-lock).
call app.aplicar_padrao_tenant('consentimento_evento',
  array['proprietario','gerente','recepcionista','assistente','profissional'],
  array['proprietario','gerente']);
drop policy consentimento_evento_delete on public.consentimento_evento;

create trigger trg_paciente_da_clinica
  before insert or update of paciente_id, clinica_id on public.consentimento_evento
  for each row execute function app.garantir_paciente_da_clinica();

-- -----------------------------------------------------------------------------
-- 2. consentimento_vigente — o gate que o fluxo consulta: existe documento do
--    tipo (tcle/uso_imagem) ASSINADO e não revogado? SECURITY INVOKER → respeita
--    a RLS de quem chama (staff só enxerga a própria clínica).
-- -----------------------------------------------------------------------------
create or replace function public.consentimento_vigente(
  p_paciente_id uuid,
  p_clinica_id  uuid,
  p_tipo        public.tipo_documento
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.documento_consentimento d
    where d.paciente_id = p_paciente_id
      and d.clinica_id  = p_clinica_id
      and d.tipo        = p_tipo
      and d.status      = 'assinado'
      and d.data_revogacao is null
  );
$$;

revoke execute on function public.consentimento_vigente from public;
grant execute on function public.consentimento_vigente to authenticated;

-- -----------------------------------------------------------------------------
-- 3. anonimizar_paciente (art. 16/18) — irreversível, SÓ admin de plataforma.
--    Apaga identificadores DIRETOS mas mantém as FKs clínicas (o prontuário é
--    retido por lei); encerra o acesso; registra. A limpeza de Storage NÃO cabe
--    aqui: o Supabase proíbe DELETE direto em storage.objects — ela roda na
--    Server Action anonimizarPaciente (Storage API + service_role) ANTES desta
--    RPC. Devolve os clinica_id vinculados para a action montar os paths.
-- -----------------------------------------------------------------------------
create or replace function public.anonimizar_paciente(
  p_paciente_id uuid,
  p_motivo      text
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid;
  v_clinicas uuid[];
begin
  if not app.is_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if not exists (select 1 from public.paciente where id = p_paciente_id) then
    raise exception 'paciente % inexistente', p_paciente_id using errcode = '23503';
  end if;

  select user_id into v_user from public.paciente where id = p_paciente_id;
  select array_agg(pc.clinica_id) into v_clinicas
    from public.paciente_clinica pc where pc.paciente_id = p_paciente_id;

  -- (a) scrub dos identificadores diretos; mantém id + vínculos clínicos
  update public.paciente set
    nome = '(paciente anonimizado)',
    cpf = null, email = null, telefone = null, data_nascimento = null,
    logradouro = null, numero = null, complemento = null, bairro = null,
    cidade = null, cep = null, uf = null, nome_mae = null,
    contato_emergencia_nome = null, contato_emergencia_telefone = null,
    contato_emergencia_parentesco = null, observacoes = null, sexo = null,
    ip_aceite = null, user_id = null,
    anonimizado = true, data_anonimizacao = now(), motivo_exclusao = p_motivo,
    ativo = false
  where id = p_paciente_id;

  -- (b) trilha de accountability por clínica vinculada
  insert into public.consentimento_evento (clinica_id, paciente_id, tipo, origem, detalhe)
  select pc.clinica_id, p_paciente_id, 'anonimizacao', 'admin', p_motivo
    from public.paciente_clinica pc
   where pc.paciente_id = p_paciente_id;

  -- (c) encerra o acesso: apaga o usuário de auth (cascata encerra as sessões)
  if v_user is not null then
    delete from auth.users where id = v_user;
  end if;

  return coalesce(v_clinicas, array[]::uuid[]);
end;
$$;

revoke execute on function public.anonimizar_paciente from public;
grant execute on function public.anonimizar_paciente to authenticated;

-- -----------------------------------------------------------------------------
-- 4. abrir_solicitacao_lgpd (art. 18) — o TITULAR logado ABRE um pedido de
--    exportação/exclusão; a EXECUÇÃO é do admin (não se auto-executa).
-- -----------------------------------------------------------------------------
create or replace function public.abrir_solicitacao_lgpd(
  p_tipo    text,
  p_detalhe text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paciente uuid := app.paciente_id();
begin
  if v_paciente is null then
    raise exception 'sem_paciente' using errcode = '42501';
  end if;
  if p_tipo not in ('exportacao','exclusao') then
    raise exception 'tipo_invalido' using errcode = '22023';
  end if;

  insert into public.consentimento_evento (clinica_id, paciente_id, tipo, origem, detalhe)
  select pc.clinica_id, v_paciente, p_tipo, 'self', p_detalhe
    from public.paciente_clinica pc
   where pc.paciente_id = v_paciente;
end;
$$;

revoke execute on function public.abrir_solicitacao_lgpd from public;
grant execute on function public.abrir_solicitacao_lgpd to authenticated;
