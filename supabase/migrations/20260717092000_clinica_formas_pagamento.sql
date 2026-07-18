-- =============================================================================
-- S2 — clinica.formas_pagamento: formas de pagamento aceitas (vitrine pública).
-- Única coluna nova da fase (CLAUDE.md — dado que a página da clínica exibe).
--
-- GRANT EXPLÍCITO OBRIGATÓRIO: a allowlist do S0 (revoke select on clinica from
-- anon + grant só das colunas públicas) faz toda coluna nova NASCER FECHADA ao
-- anon. Sem o grant abaixo, a página pública leria a coluna com 42501. Este é o
-- efeito colateral desejado do S0 (publicar exige decisão explícita) — aqui a
-- decisão é: formas_pagamento é vitrine, então liberamos ao anon.
--
-- NÃO recria a view marketplace_clinica: o funil lê formas_pagamento (e o
-- endereço completo) da tabela base `clinica` — o mesmo caminho que
-- clinicaPorSlug já usa para telefone/email (marketplace.ts). Nenhum consumidor
-- da view (/, /buscar) exibe formas de pagamento, então recriá-la só adicionaria
-- o risco de esquecer o regrant, sem benefício.
--
-- authenticated é intocado (herda o grant de tabela): o painel pode ler/gravar.
-- =============================================================================

alter table public.clinica
  add column formas_pagamento public.forma_pagamento[];

grant select (formas_pagamento) on public.clinica to anon;
