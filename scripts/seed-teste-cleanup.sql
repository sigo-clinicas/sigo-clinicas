-- =============================================================================
-- LIMPEZA REVERSA de TODO o dado de teste/demonstração.
-- Cobre os dois seeds:  scripts/seed-teste.mjs  (base)
--                       scripts/seed-demo.mjs   (enriquecimento da demo)
-- Rodar no lançamento para remover TODO o dado de teste do projeto.
--
-- Onde rodar: SQL Editor do Supabase (role postgres) OU psql/service_role.
-- Idempotente: pode rodar quantas vezes quiser (no-op se nada restar).
--
-- ⚠️ ORDEM OBRIGATÓRIA (2 passos) — o Storage NÃO é limpável por SQL:
--    1º)  node scripts/seed-demo.mjs --limpar-storage
--    2º)  este .sql
--
--    Por que não dá para apagar o Storage aqui: o Postgres do Supabase tem o
--    gatilho `storage.protect_delete()`, que RECUSA delete direto em
--    `storage.objects` ("Use the Storage API instead", SQLSTATE 42501). Se este
--    script tentasse, a exceção abortaria TODO o bloco e nada seria apagado.
--    Por isso a remoção dos arquivos é feita só pela API (passo 1) e aqui
--    apenas CONFERIMOS que sobrou 0 (ver a query de conferência no final).
--
-- Apaga SOMENTE dado marcado como teste:
--   • clínicas com nome ILIKE '[TESTE]%'  → e, por CASCADE do FK clinica_id,
--     TODO o dado gerado nelas (auditado: das 44 tabelas com FK para clinica,
--     43 são ON DELETE CASCADE — só `lead` é SET NULL, tratado à parte):
--     consultas, orçamentos, itens, vendas, pagamentos, lançamentos, baixas,
--     movimentações de conta/estoque, comissões, avaliações, evoluções,
--     insumos, documentos, consentimentos, respostas de anamnese, galeria,
--     profissionais, serviços, tabelas de preço, convênios, contas, categorias,
--     centros de custo, cupons, depoimentos, campanhas, sala VIP + membros,
--     destaque do marketplace, vínculos de especialidade e de staff;
--   • leads dessas clínicas (FK ON DELETE SET NULL → não cascateia) e leads
--     já órfãos marcados '[TESTE]%';
--   • pacientes globais marcados '[TESTE]%' e os que ficaram ÓRFÃOS por só
--     existirem nessas clínicas de teste (nunca um paciente ainda vinculado a
--     uma clínica real);
--   • usuários de auth do domínio @sigo.local.
-- (Os arquivos do Storage saem no passo 1 — ver aviso de ordem acima.)
--
-- NÃO toca em: especialidade / segmento (seed determinístico: 66 e 4),
-- schema/migrations, nem em qualquer dado sem a marca de teste.
-- =============================================================================

do $$
declare
  v_clinicas  uuid[];
  v_pac_teste uuid[];
begin
  -- 0) IDs das clínicas de teste — capturados ANTES do delete, pois o prefixo
  --    dos arquivos no Storage é o clinica_id.
  select coalesce(array_agg(id), '{}')
    into v_clinicas
  from public.clinica
  where nome ilike '[TESTE]%';

  -- pacientes atualmente vinculados a alguma clínica de teste (p/ achar órfãos depois)
  select coalesce(array_agg(distinct pc.paciente_id), '{}')
    into v_pac_teste
  from public.paciente_clinica pc
  where pc.clinica_id = any(v_clinicas);

  -- 1) leads das clínicas de teste (não cascateiam) — apagar enquanto o vínculo
  --    existe; + os que já ficaram órfãos (clinica_id nulo) mas são marcados.
  delete from public.lead where clinica_id = any(v_clinicas);
  delete from public.lead where clinica_id is null and nome ilike '[TESTE]%';

  -- 2) as clínicas de teste — CASCADE remove todo o resto do tenant
  delete from public.clinica where id = any(v_clinicas);

  -- (Storage: ver aviso no cabeçalho — sai no passo 1, via API. Delete direto
  --  em storage.objects é bloqueado por storage.protect_delete().)

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
  (select count(*) from public.clinica  where nome  ilike '[TESTE]%')     as clinicas_teste,
  (select count(*) from public.paciente where nome  ilike '[TESTE]%')     as pacientes_teste,
  (select count(*) from public.lead     where nome  ilike '[TESTE]%')     as leads_teste,
  (select count(*) from auth.users      where email ilike '%@sigo.local') as usuarios_teste,
  (select count(*) from storage.objects
     where bucket_id in ('prontuario','documentos','logos')
       and name ~ '^[0-9a-f-]{36}/demo/')                                 as arquivos_demo;

-- Sanidade do seed determinístico — deve continuar 66 e 4:
select
  (select count(*) from public.especialidade) as especialidades_devem_ser_66,
  (select count(*) from public.segmento)      as segmentos_devem_ser_4;
