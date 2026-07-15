-- =============================================================================
-- LIMPEZA REVERSA do seed de teste (scripts/seed-teste.mjs).
-- Rodar no lançamento para remover TODO o dado de teste do projeto.
--
-- Onde rodar: SQL Editor do Supabase (role postgres) OU psql/service_role.
-- Idempotente: pode rodar quantas vezes quiser (no-op se nada restar).
--
-- Apaga SOMENTE dado marcado como teste:
--   • clínicas com nome ILIKE '[TESTE]%'  → e, por CASCADE do FK clinica_id,
--     TODO o dado gerado nelas durante os testes (consultas, orçamentos, vendas,
--     pagamentos, lançamentos, movimentações, evoluções, respostas de anamnese,
--     comissões, cupons, depoimentos, etc.);
--   • leads dessas clínicas (o FK de lead é ON DELETE SET NULL, não cascateia);
--   • pacientes globais marcados '[TESTE]%' e os que ficaram ÓRFÃOS por só
--     existirem nessas clínicas de teste (nunca um paciente ainda vinculado a
--     uma clínica real);
--   • usuários de auth do domínio @sigo.local.
--
-- NÃO toca em: especialidade / segmento (seed determinístico), schema/migrations,
-- nem em qualquer dado sem a marca de teste.
-- =============================================================================

do $$
declare
  v_pac_teste uuid[];
begin
  -- pacientes atualmente vinculados a alguma clínica de teste (p/ achar órfãos depois)
  select coalesce(array_agg(distinct pc.paciente_id), '{}')
    into v_pac_teste
  from public.paciente_clinica pc
  join public.clinica c on c.id = pc.clinica_id
  where c.nome ilike '[TESTE]%';

  -- 1) leads das clínicas de teste (não cascateiam) — apagar enquanto o vínculo existe
  delete from public.lead
   where clinica_id in (select id from public.clinica where nome ilike '[TESTE]%');

  -- 2) as clínicas de teste — CASCADE remove todo o resto do tenant
  delete from public.clinica where nome ilike '[TESTE]%';

  -- 3) pacientes de teste: os marcados + os órfãos (sem nenhum vínculo restante)
  delete from public.paciente p
   where p.nome ilike '[TESTE]%'
      or ( p.id = any(v_pac_teste)
           and not exists (select 1 from public.paciente_clinica pc where pc.paciente_id = p.id) );

  -- 4) usuários de teste (somente o domínio reservado @sigo.local)
  delete from auth.users where email ilike '%@sigo.local';
end $$;

-- Conferência — deve retornar 0 em TODAS as colunas:
select
  (select count(*) from public.clinica  where nome  ilike '[TESTE]%')  as clinicas_teste,
  (select count(*) from public.paciente where nome  ilike '[TESTE]%')  as pacientes_teste,
  (select count(*) from auth.users      where email ilike '%@sigo.local') as usuarios_teste;
