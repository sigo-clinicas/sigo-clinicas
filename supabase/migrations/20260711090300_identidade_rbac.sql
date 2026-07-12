-- =============================================================================
-- 0300 IDENTIDADE + RBAC MULTI-TENANT
-- clinica (raiz do tenant), clinica_usuario (staff + papel),
-- paciente (GLOBAL — A1/M3), paciente_clinica (vínculo N:N),
-- Custom Access Token Hook (claims: clinicas, admin_plataforma, paciente_id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Clínica — raiz do tenant. `tipo` dirige o white-label (tema + terminologia).
-- -----------------------------------------------------------------------------
create table public.clinica (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null,
  razao_social           text,
  cnpj                   text,
  tipo                   public.tipo_clinica not null default 'medica',
  slug                   text unique,
  email                  text,
  telefone               text,
  cep                    text,
  uf                     char(2),
  cidade                 text,
  bairro                 text,
  logradouro             text,
  numero                 text,
  complemento            text,
  sobre                  text,
  logo_path              text,
  fotos                  jsonb not null default '[]'::jsonb,
  horarios               jsonb not null default '{}'::jsonb,
  validade_orcamento_dias int  not null default 30,
  validade_anamnese_dias  int  not null default 30,
  exibir_marketplace     boolean not null default true,
  ativo                  boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_clinica_cidade on public.clinica (cidade) where ativo;

-- -----------------------------------------------------------------------------
-- Staff da clínica: binding usuário × clínica × papel (base do RBAC).
-- Papéis espelham o AuthorizationListener do legado; `admin` é global
-- (admin_plataforma) e `cliente` é o paciente com login (paciente.user_id).
-- -----------------------------------------------------------------------------
create table public.clinica_usuario (
  id         uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinica (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  papel      public.papel_clinica not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, user_id)
);

create index idx_clinica_usuario_user on public.clinica_usuario (user_id);

-- -----------------------------------------------------------------------------
-- Paciente GLOBAL da plataforma (corrige A1; requisito M3 do contrato).
-- CPF/e-mail identificam a pessoa uma única vez; o vínculo com cada clínica
-- fica em paciente_clinica. Dados de convênio são por clínica (migration 0400).
-- -----------------------------------------------------------------------------
create table public.paciente (
  id                            uuid primary key default gen_random_uuid(),
  user_id                       uuid unique references auth.users (id) on delete set null,
  nome                          text not null,
  cpf                           text unique,
  data_nascimento               date,
  sexo                          public.sexo,
  telefone                      text,
  email                         text,
  cep                           text,
  uf                            char(2),
  cidade                        text,
  bairro                        text,
  logradouro                    text,
  numero                        text,
  complemento                   text,
  nome_mae                      text,
  contato_emergencia_nome       text,
  contato_emergencia_telefone   text,
  contato_emergencia_parentesco text,
  observacoes                   text,
  termos_aceitos                boolean not null default false,
  data_aceite_termos            timestamptz,
  ativo                         boolean not null default true,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- Vínculo N:N paciente × clínica (com status, superando o pivô simples do
-- legado). `origem` = como o paciente chegou ÀQUELA clínica.
create table public.paciente_clinica (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references public.clinica (id) on delete cascade,
  paciente_id uuid not null references public.paciente (id) on delete cascade,
  origem      text,
  observacoes text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (clinica_id, paciente_id)
);

create index idx_paciente_clinica_paciente on public.paciente_clinica (paciente_id);

-- -----------------------------------------------------------------------------
-- CUSTOM ACCESS TOKEN HOOK — injeta claims de RBAC no JWT a cada emissão.
-- Configurar em Auth > Hooks (dashboard) ou supabase/config.toml (local).
-- Observação operacional: claims são recalculados a cada REFRESH do token
-- (~1h). Mudança/remoção de papel só vale no próximo refresh; para revogação
-- imediata, encerrar as sessões do usuário (auth.admin.signOut) na Server
-- Action que altera o papel.
-- -----------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user_id  uuid  := (event ->> 'user_id')::uuid;
  v_claims   jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_clinicas jsonb;
  v_admin    boolean;
  v_paciente uuid;
begin
  select coalesce(jsonb_object_agg(cu.clinica_id::text, cu.papel::text), '{}'::jsonb)
    into v_clinicas
    from public.clinica_usuario cu
   where cu.user_id = v_user_id
     and cu.ativo;

  select exists (select 1 from public.admin_plataforma a where a.user_id = v_user_id)
    into v_admin;

  select p.id into v_paciente
    from public.paciente p
   where p.user_id = v_user_id;

  v_claims := jsonb_set(v_claims, '{clinicas}', v_clinicas);
  v_claims := jsonb_set(v_claims, '{admin_plataforma}', to_jsonb(v_admin));
  if v_paciente is not null then
    v_claims := jsonb_set(v_claims, '{paciente_id}', to_jsonb(v_paciente::text));
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- O hook roda como supabase_auth_admin: precisa executar a função e ler as
-- 3 tabelas de RBAC (via policies dedicadas). Nunca expor a authenticated/anon.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

grant select on public.clinica_usuario  to supabase_auth_admin;
grant select on public.admin_plataforma to supabase_auth_admin;
grant select on public.paciente         to supabase_auth_admin;

create policy auth_admin_le_clinica_usuario on public.clinica_usuario
  for select to supabase_auth_admin using (true);
create policy auth_admin_le_admin_plataforma on public.admin_plataforma
  for select to supabase_auth_admin using (true);
create policy auth_admin_le_paciente on public.paciente
  for select to supabase_auth_admin using (true);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.clinica          enable row level security;
alter table public.clinica_usuario  enable row level security;
alter table public.paciente         enable row level security;
alter table public.paciente_clinica enable row level security;

create trigger trg_updated_at before update on public.clinica
  for each row execute function app.set_updated_at();
create trigger trg_updated_at before update on public.clinica_usuario
  for each row execute function app.set_updated_at();
create trigger trg_updated_at before update on public.paciente
  for each row execute function app.set_updated_at();
create trigger trg_updated_at before update on public.paciente_clinica
  for each row execute function app.set_updated_at();

-- CLINICA: membro vê a própria; marketplace público vê clínicas ativas;
-- só proprietário edita; criação/remoção de clínica é operação de plataforma
-- (admin ou service_role via fluxo de onboarding).
create policy clinica_select_membro on public.clinica
  for select to authenticated
  using (app.tem_clinica(id));

create policy clinica_select_marketplace on public.clinica
  for select to anon, authenticated
  using (ativo and exibir_marketplace);

create policy clinica_update_proprietario on public.clinica
  for update to authenticated
  using (app.tem_papel(id, array['proprietario']))
  with check (app.tem_papel(id, array['proprietario']));

create policy clinica_insert_admin on public.clinica
  for insert to authenticated
  with check (app.is_admin());

create policy clinica_delete_admin on public.clinica
  for delete to authenticated
  using (app.is_admin());

-- CLINICA_USUARIO: membro vê o quadro da clínica; o próprio usuário vê seus
-- vínculos. Escrita: proprietário gerencia tudo; gerente gerencia papéis
-- abaixo de proprietário (anti-escalação de privilégio).
create policy clinica_usuario_select on public.clinica_usuario
  for select to authenticated
  using (app.tem_clinica(clinica_id) or user_id = auth.uid());

create policy clinica_usuario_insert on public.clinica_usuario
  for insert to authenticated
  with check (
    app.tem_papel(clinica_id, array['proprietario'])
    or (app.tem_papel(clinica_id, array['gerente']) and papel <> 'proprietario')
  );

create policy clinica_usuario_update on public.clinica_usuario
  for update to authenticated
  using (
    app.tem_papel(clinica_id, array['proprietario'])
    or (app.tem_papel(clinica_id, array['gerente']) and papel <> 'proprietario')
  )
  with check (
    app.tem_papel(clinica_id, array['proprietario'])
    or (app.tem_papel(clinica_id, array['gerente']) and papel <> 'proprietario')
  );

create policy clinica_usuario_delete on public.clinica_usuario
  for delete to authenticated
  using (
    app.tem_papel(clinica_id, array['proprietario'])
    or (app.tem_papel(clinica_id, array['gerente']) and papel <> 'proprietario')
  );

-- PACIENTE (global): staff só enxerga pacientes vinculados às suas clínicas;
-- o paciente enxerga/edita o próprio cadastro (LGPD). Qualquer staff cria o
-- cadastro global (o vínculo com a clínica é criado em seguida, na mesma
-- Server Action). Exclusão definitiva: apenas admin (fluxo LGPD).
create policy paciente_select on public.paciente
  for select to authenticated
  using (
    app.is_admin()
    or user_id = auth.uid()
    or id = app.paciente_id()
    or exists (
      select 1 from public.paciente_clinica pc
      where pc.paciente_id = paciente.id
        and app.tem_clinica(pc.clinica_id)
    )
  );

create policy paciente_insert on public.paciente
  for insert to authenticated
  with check (
    app.is_admin()
    or app.clinicas() <> '{}'::jsonb
    or user_id = auth.uid()
  );

create policy paciente_update on public.paciente
  for update to authenticated
  using (
    app.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.paciente_clinica pc
      where pc.paciente_id = paciente.id
        and app.tem_papel(pc.clinica_id,
          array['proprietario','gerente','recepcionista','assistente','profissional'])
    )
  )
  with check (
    app.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.paciente_clinica pc
      where pc.paciente_id = paciente.id
        and app.tem_papel(pc.clinica_id,
          array['proprietario','gerente','recepcionista','assistente','profissional'])
    )
  );

create policy paciente_delete_admin on public.paciente
  for delete to authenticated
  using (app.is_admin());

-- PACIENTE_CLINICA: staff da clínica gerencia o vínculo (profissional não
-- exclui — matriz do legado); paciente vê os próprios vínculos.
-- IMPORTANTE: usa o claim app.paciente_id() (e NÃO subquery em paciente) —
-- as policies de paciente consultam paciente_clinica, e uma referência de
-- volta criaria recursão infinita de policy (42P17).
create policy paciente_clinica_select on public.paciente_clinica
  for select to authenticated
  using (
    app.tem_clinica(clinica_id)
    or paciente_id = app.paciente_id()
  );

create policy paciente_clinica_insert on public.paciente_clinica
  for insert to authenticated
  with check (app.tem_papel(clinica_id,
    array['proprietario','gerente','recepcionista','assistente','profissional']));

create policy paciente_clinica_update on public.paciente_clinica
  for update to authenticated
  using (app.tem_papel(clinica_id,
    array['proprietario','gerente','recepcionista','assistente','profissional']))
  with check (app.tem_papel(clinica_id,
    array['proprietario','gerente','recepcionista','assistente','profissional']));

create policy paciente_clinica_delete on public.paciente_clinica
  for delete to authenticated
  using (app.tem_papel(clinica_id,
    array['proprietario','gerente','recepcionista','assistente']));
