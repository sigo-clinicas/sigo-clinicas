-- =============================================================================
-- S6 — clinica.timezone: fuso da clínica para o cálculo de slots (leitura) e a
-- revalidação de janela na escrita (agendar_publico v2). O servidor roda em UTC
-- (Vercel gru1); sem o fuso, os slots saíam 3h errados em produção.
--
-- Grant ao anon (allowlist do S0 fecha colunas novas): o cliente formata os
-- horários dos slots no fuso da clínica. authenticated herda o grant de tabela.
-- =============================================================================

alter table public.clinica
  add column timezone text not null default 'America/Sao_Paulo';

grant select (timezone) on public.clinica to anon;
