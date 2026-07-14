-- =============================================================================
-- S4-6 — HARDENING de fechamento da Fase 1. Endereça os advisors de segurança
-- (search_path mutável, listing de bucket público, EXECUTE p/ anon em RPCs) e
-- adiciona rate-limit + purga LGPD parametrizável (DESLIGADA por default).
--
-- NÃO endereçado aqui (por design): os avisos 0029 "authenticated pode executar
-- SECURITY DEFINER" nas RPCs de tenant — é intencional (Opção B do CLAUDE.md:
-- RPCs SECURITY DEFINER com gate interno via app.tem_papel). E o
-- auth_leaked_password_protection, que é CONFIG do Auth (dashboard/Management
-- API), não migration — sinalizado no de-para para ligar na homologação.
-- =============================================================================

-- 1) search_path imutável nas 2 funções app apontadas pelo linter (0011) -------
-- Ambas só referenciam objetos qualificados (app./public.) ou pg_catalog, então
-- search_path='' é seguro. aplicar_padrao_tenant só roda em tempo de migration.
alter function  app.set_updated_at() set search_path = '';
alter procedure app.aplicar_padrao_tenant(text, text[], text[], boolean) set search_path = '';

-- 2) Bucket público `logos`: remove o SELECT amplo que permite LISTAR (0025).
-- Bucket é público → URLs de objeto continuam resolvendo sem policy de SELECT.
drop policy if exists logos_select on storage.objects;

-- 3) Fecha EXECUTE de RPCs SECURITY DEFINER ao `anon` (0028) -------------------
-- agendar_publico é chamado SÓ server-side (service_role, rota /api/publico) —
-- nem anon nem authenticated precisam executá-lo diretamente.
revoke execute on function public.agendar_publico(
  uuid, uuid, timestamptz, uuid[], text, text, text, text, text) from anon, authenticated;

-- RPCs de tenant: o gate app.tem_papel já barra o anon (retorna 42501), mas
-- fechamos a porta na camada de grant (defesa em profundidade). authenticated
-- permanece — é quem legitimamente as chama.
revoke execute on function public.abrir_solicitacao_lgpd(text, text) from anon;
revoke execute on function public.anonimizar_paciente(uuid, text) from anon;
revoke execute on function public.apurar_comissao(uuid, uuid, date, date, uuid, jsonb) from anon;
revoke execute on function public.cancelar_apuracao_comissao(uuid, uuid) from anon;
revoke execute on function public.estornar_baixa_lancamento(uuid, uuid) from anon;
revoke execute on function public.registrar_baixa_lancamento(
  uuid, uuid, uuid, numeric, date, public.forma_pagamento, text) from anon;
revoke execute on function public.registrar_saida_estoque(uuid, date, text, jsonb) from public, anon;
revoke execute on function public.salvar_orcamento(uuid, jsonb, jsonb) from anon;
revoke execute on function public.salvar_paciente_clinica(uuid, uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.vender_orcamento(
  uuid, uuid, public.forma_pagamento, date, jsonb) from anon;

-- helper interno de bootstrap de RLS: nunca deveria estar na API REST.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 4) Rate-limit (fixed window) — bucket + RPC atômica ------------------------
-- Tabela no schema `app` (fora dos schemas expostos ao PostgREST) — só o
-- servidor (service_role) toca. RLS ligada sem policies = deny a anon/auth.
create table if not exists app.rate_limit_bucket (
  chave         text primary key,
  janela_inicio timestamptz not null default now(),
  contador      int not null default 0
);
alter table app.rate_limit_bucket enable row level security;

-- Retorna true se a requisição está DENTRO do limite (e conta +1), false se
-- estourou. Fixed window por (chave). Uma única upsert = atômico sob concorrência.
create or replace function public.consumir_rate_limit(
  p_chave text, p_limite int, p_janela_seg int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cont  int;
  v_agora timestamptz := now();
begin
  insert into app.rate_limit_bucket as b (chave, janela_inicio, contador)
  values (p_chave, v_agora, 1)
  on conflict (chave) do update set
    contador = case
      when b.janela_inicio < v_agora - make_interval(secs => p_janela_seg) then 1
      else b.contador + 1 end,
    janela_inicio = case
      when b.janela_inicio < v_agora - make_interval(secs => p_janela_seg) then v_agora
      else b.janela_inicio end
  returning b.contador into v_cont;
  return v_cont <= p_limite;
end;
$$;
revoke execute on function public.consumir_rate_limit(text, int, int) from public, anon, authenticated;
grant  execute on function public.consumir_rate_limit(text, int, int) to service_role;

-- 5) Purga LGPD por retenção — IMPLEMENTADA mas DESLIGADA por default --------
-- p_dry_run=true (default) só CONTA o que seria apagado; p_retencao_dias é
-- OBRIGATÓRIO (sem default de prazo — não "chutar" retenção). NÃO agendada
-- (sem pg_cron): a cliente define o prazo e liga na homologação. Alvos: dados
-- de contato sem vínculo assistencial (leads) e tokens de anamnese abandonados.
create or replace function public.purgar_por_retencao(
  p_retencao_dias int default null,
  p_dry_run       boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corte     timestamptz;
  v_leads     int;
  v_leads_vip int;
  v_anamneses int;
begin
  if p_retencao_dias is null or p_retencao_dias <= 0 then
    raise exception 'retencao nao configurada: informe p_retencao_dias (> 0)'
      using errcode = '22023';
  end if;
  v_corte := now() - make_interval(days => p_retencao_dias);

  select count(*) into v_leads     from public.lead          where created_at < v_corte;
  select count(*) into v_leads_vip from public.lead_sala_vip where created_at < v_corte;
  select count(*) into v_anamneses from public.resposta_anamnese
    where status = 'pendente' and coalesce(expira_em, created_at) < v_corte;

  if not p_dry_run then
    delete from public.lead          where created_at < v_corte;
    delete from public.lead_sala_vip where created_at < v_corte;
    delete from public.resposta_anamnese
      where status = 'pendente' and coalesce(expira_em, created_at) < v_corte;
  end if;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'retencao_dias', p_retencao_dias,
    'corte', v_corte,
    'leads', v_leads,
    'leads_sala_vip', v_leads_vip,
    'anamneses_abandonadas', v_anamneses
  );
end;
$$;
revoke execute on function public.purgar_por_retencao(int, boolean) from public, anon, authenticated;
grant  execute on function public.purgar_por_retencao(int, boolean) to service_role;
