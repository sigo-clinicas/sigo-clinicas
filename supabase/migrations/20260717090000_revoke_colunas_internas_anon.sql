-- =============================================================================
-- S0 (HOTFIX DE SEGURANÇA) — fecha as colunas internas de clinica/profissional
-- ao role anon.
--
-- PROBLEMA: clinica_select_marketplace (`using (ativo and exibir_marketplace)`)
-- expõe a LINHA da clínica pública ao anon — e isso está CORRETO, é o que faz o
-- marketplace funcionar. Mas RLS é ROW-level: não restringe coluna. Como o anon
-- tinha SELECT no nível da TABELA (default do Supabase), este GET funcionava com
-- a chave publishable — que está no browser de todo visitante:
--     GET /rest/v1/clinica?select=cnpj,razao_social,config&ativo=eq.true
--
-- NÃO adianta "selecionar coluna a coluna" no nosso código: já fazemos isso
-- (marketplace.ts não tem um único select *) e o vazamento persistia. O vetor é
-- o PostgREST direto, não a nossa query.
--
-- MECANISMO — por que ALLOWLIST e não `revoke select (col)`:
-- O Postgres ignora revoke de coluna quando o role tem o privilégio na tabela:
--   "if a role has been granted privileges on a table, then revoking the same
--    privileges from individual columns will have no effect."
-- Como anon tinha SELECT de tabela, um `revoke select (cnpj) ... from anon`
-- seria NO-OP: passaria no review sem fechar nada. Então: revoga o SELECT da
-- tabela e concede de volta APENAS as colunas públicas.
--
-- Efeito colateral desejado: coluna nova nasce FECHADA ao anon. Publicar passa a
-- exigir um grant explícito — decisão consciente, não vazamento por omissão.
--
-- ESCOPO DELIBERADO: só `anon`. `authenticated` fica intocado — o painel lê
-- cnpj/razao_social/config como authenticated (painel/configuracoes/page.tsx,
-- lib/actions/clinica.ts, lib/actions/comissoes.ts:62) e não pode quebrar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- clinica — fecham: razao_social, cnpj, config (contém base_comissao),
-- retencao_* (LGPD), is_seed_demo, validade_* (config operacional) e timestamps.
-- Ficam: a vitrine. `telefone`/`email` são lidos por clinicaPorSlug
-- (src/lib/marketplace.ts:144) com o client anon — revogá-los quebraria a página
-- pública da clínica. `ativo`/`exibir_marketplace` são exigidos pelo WHERE da
-- view marketplace_clinica, que é security_invoker (roda com o privilégio do
-- anon) — sem eles a busca inteira cai.
-- ---------------------------------------------------------------------------
revoke select on public.clinica from anon;

grant select (
  id,
  nome,
  tipo,
  slug,
  email,
  telefone,
  cep,
  uf,
  cidade,
  bairro,
  logradouro,
  numero,
  complemento,
  sobre,
  logo_path,
  fotos,
  horarios,
  exibir_marketplace,
  ativo
) on public.clinica to anon;

-- ---------------------------------------------------------------------------
-- profissional — fecham: cpf, data_nascimento, email, telefone, user_id, sexo
-- (PII sob LGPD, sem razão de estar na vitrine), a janela de atendimento
-- (horario_inicio/fim, dias_atendimento — o cálculo de slots roda server-side
-- com service_role, nunca pelo anon), `cor` (interno da agenda) e timestamps.
-- Ficam: o que clinicaPorSlug lê (src/lib/marketplace.ts:153-154) + foto_path
-- (bucket `logos` é público) + `ativo`, exigido pela policy e pelos filtros.
-- ---------------------------------------------------------------------------
revoke select on public.profissional from anon;

grant select (
  id,
  clinica_id,
  nome,
  nome_conselho,
  numero_registro,
  foto_path,
  ativo
) on public.profissional to anon;
