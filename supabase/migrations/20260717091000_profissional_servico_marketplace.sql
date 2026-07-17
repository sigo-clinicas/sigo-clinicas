-- =============================================================================
-- S1 — Cruzamento serviço ↔ profissional no marketplace público.
--
-- A página da clínica precisa cruzar profissional_servico nos dois sentidos.
-- Isso exige uma policy anon nova nessa tabela — que hoje é tenant-only.
--
-- DUAS CORREÇÕES sobre o plano original, ambas aprendidas no S0/verificação:
--
-- 1) `to anon` APENAS, não `to anon, authenticated`.
--    As 16 policies de marketplace da casa são `to anon, authenticated`. Como
--    policies PERMISSIVE fazem OR entre roles, espelhar esse padrão SOMARIA esta
--    policy à profissional_servico_select_membro para o authenticated → staff
--    logado da clínica A leria vínculos (e comissão) da clínica B, se B for
--    pública. profissional_servico carrega tipo_comissao/valor_comissao — dado
--    comercial interno (CLAUDE.md §5). Mínimo privilégio: só anon.
--
-- 2) ALLOWLIST de coluna, não `revoke select (col)`.
--    `revoke select (valor_comissao) ... from anon` seria NO-OP: o anon tem
--    SELECT no nível da TABELA (default do Supabase) e o Postgres ignora revoke
--    de coluna nesse caso (mesma armadilha do S0). Revoga o SELECT da tabela e
--    concede de volta só as colunas do cruzamento. Comissão nunca sai.
--
-- GATE mais estrito que profissional_especialidade_select_marketplace (que só
-- checa a clínica): aqui exige também profissional.ativo e servico.exibir_publico
-- — senão vazariam vínculos de profissionais inativos e de serviços internos.
-- =============================================================================

create policy profissional_servico_select_marketplace
  on public.profissional_servico
  for select to anon
  using (
    exists (select 1 from public.clinica c
            where c.id = clinica_id and c.ativo and c.exibir_marketplace)
    and exists (select 1 from public.profissional p
                where p.id = profissional_id and p.ativo)
    and exists (select 1 from public.servico s
                where s.id = servico_id and s.ativo and s.exibir_publico)
  );

-- Allowlist: fecha tipo_comissao/valor_comissao (e created_at/updated_at) ao anon.
-- `authenticated` é intocado — a policy _membro + o grant de tabela seguem dando
-- acesso pleno à comissão da própria clínica (comissoes.ts:90,
-- profissionais-client.tsx:276).
revoke select on public.profissional_servico from anon;

grant select (
  id,
  clinica_id,
  profissional_id,
  servico_id
) on public.profissional_servico to anon;
