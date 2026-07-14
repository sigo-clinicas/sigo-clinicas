-- =============================================================================
-- S3-1 — Orçamento: deltas para o funil validado do Base44
--   (a) Orçamento avulso: paciente_id nullable + snapshot cliente_* + check.
--   (b) Item de produto de estoque: item_estoque_id/unidade + servico_id nullable
--       (exatamente um de servico_id / item_estoque_id).
--   (c) Trigger de isolamento paciente↔clínica em orcamento (só quando há paciente;
--       avulso com paciente_id NULL pula o trigger — comentário anotado no
--       20260712110000_prontuario_lgpd_fundacoes.sql:91).
-- Preserva UX validada (avulso; produto no orçamento) SEM tornar a
-- desnormalização o padrão: o caminho por FK (paciente_id, servico_id) segue
-- primário; snapshots cliente_* só existem para o orçamento avulso.
-- =============================================================================

-- (a) Orçamento avulso --------------------------------------------------------
alter table public.orcamento
  alter column paciente_id drop not null,
  add column cliente_nome     text,
  add column cliente_telefone text,
  add column cliente_email    text,
  add constraint orcamento_cliente_presente
    check (paciente_id is not null or cliente_nome is not null);

-- (b) Item de produto de estoque no orçamento ---------------------------------
alter table public.item_orcamento
  alter column servico_id drop not null,
  add column item_estoque_id uuid references public.item_estoque (id) on delete set null,
  add column unidade         text,
  add constraint item_orcamento_origem
    check ((servico_id is not null) <> (item_estoque_id is not null));

create index idx_item_orcamento_item_estoque
  on public.item_orcamento (item_estoque_id)
  where item_estoque_id is not null;

-- (c) Isolamento paciente↔clínica no orçamento --------------------------------
-- Reusa app.garantir_paciente_da_clinica() (S2). WHEN evita disparar no avulso.
create trigger trg_paciente_da_clinica
  before insert or update of paciente_id, clinica_id on public.orcamento
  for each row
  when (new.paciente_id is not null)
  execute function app.garantir_paciente_da_clinica();
