-- =============================================================================
-- 2000 FUNDAÇÕES DO PRONTUÁRIO/LGPD (Sprint 2, S2-0) — só o que é CARO mudar
-- depois: ALTERs em tabelas clínicas sob retenção, retention-lock e o trigger
-- de isolamento paciente↔clínica. Lógica pesada (RPCs de anonimização/purga,
-- consentimento_evento, galeria_foto, baixa de insumos) fica nas slices que
-- as usam (S2-3/S2-5). Decisões D1–D8 aprovadas pela liderança.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- D3 — VOZ/TRANSCRIÇÃO (escopo F1, Módulo 2): estrutura pronta para receber a
-- captação por voz na evolução, mesmo sem o ASR plugado agora. O texto ditado
-- cai em evolucao_sessao.descricao_atendimento (colunas de proveniência abaixo
-- só registram origem/rastro). Alterar evolucao_sessao depois — já com registro
-- clínico retido — é caro; por isso entra agora.
-- -----------------------------------------------------------------------------
alter table public.evolucao_sessao
  add column descricao_origem     text not null default 'manual'
    check (descricao_origem in ('manual', 'voz')),
  add column transcricao_audio_path  text,
  add column transcricao_texto_bruto text,
  add column transcricao_status      text;

-- -----------------------------------------------------------------------------
-- D8 — LGPD (colunas baratas landadas cedo; lógica de anonimização/purga é S2-5).
-- ALTERam tabelas que passam a guardar dado sob retenção → caras de mudar depois.
-- -----------------------------------------------------------------------------
alter table public.paciente
  add column anonimizado          boolean not null default false,
  add column data_anonimizacao    timestamptz,
  add column motivo_exclusao      text,
  add column versao_termos_aceita text,
  add column ip_aceite            inet;

alter table public.documento_consentimento
  add column versao         text,
  add column data_revogacao  timestamptz;

-- Consentimento é revogável (art. 8, §5 LGPD) — o enum precisa do estado.
alter type public.status_documento add value if not exists 'revogado';

-- Retenção por finalidade (valores PENDENTES da cliente; purga automática NÃO
-- é implementada agora — só o campo de configuração).
alter table public.clinica
  add column retencao_prontuario_meses int,
  add column retencao_fiscal_meses     int,
  add column retencao_marketing_meses  int;

-- -----------------------------------------------------------------------------
-- D1 — RETENTION-LOCK: registro clínico é retido por lei; os papéis de escrita
-- NÃO podem hard-delete. Removemos as policies *_delete geradas por
-- aplicar_padrao_tenant nas 4 tabelas de registro clínico de topo. Remoção
-- legítima (anonimização) passará por RPC auditada (S2-5).
-- evolucao_insumo NÃO é travada aqui — seu ciclo de vida (add/remover insumo,
-- reverter baixa) é gerido pela RPC baixar_insumos_evolucao no S2-3.
-- -----------------------------------------------------------------------------
drop policy avaliacao_clinica_delete       on public.avaliacao_clinica;
drop policy evolucao_sessao_delete         on public.evolucao_sessao;
drop policy resposta_anamnese_delete       on public.resposta_anamnese;
drop policy documento_consentimento_delete on public.documento_consentimento;

-- -----------------------------------------------------------------------------
-- D2 — TRIGGER DE ISOLAMENTO paciente↔clínica (PRIORIDADE MÁXIMA).
-- O RLS só cobra clinica_id; NÃO valida que o paciente_id está vinculado
-- àquela clínica (paciente_clinica). Sem isto, um staff ancora prontuário de
-- paciente de OUTRA clínica no próprio tenant — furo de isolamento de dado de
-- saúde que a RLS não expressa. SECURITY DEFINER: valida o estado real,
-- independente da visibilidade RLS do chamador.
-- -----------------------------------------------------------------------------
create or replace function app.garantir_paciente_da_clinica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.paciente_clinica pc
    where pc.paciente_id = new.paciente_id
      and pc.clinica_id  = new.clinica_id
  ) then
    raise exception
      'paciente % nao esta vinculado a clinica % (isolamento de tenant)',
      new.paciente_id, new.clinica_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Aplicado às tabelas de registro clínico + consulta (mesmo furo na agenda).
-- orcamento recebe o mesmo trigger no S3, quando ganhar UI/fluxo.
create trigger trg_paciente_da_clinica
  before insert or update of paciente_id, clinica_id on public.avaliacao_clinica
  for each row execute function app.garantir_paciente_da_clinica();

create trigger trg_paciente_da_clinica
  before insert or update of paciente_id, clinica_id on public.evolucao_sessao
  for each row execute function app.garantir_paciente_da_clinica();

create trigger trg_paciente_da_clinica
  before insert or update of paciente_id, clinica_id on public.resposta_anamnese
  for each row execute function app.garantir_paciente_da_clinica();

create trigger trg_paciente_da_clinica
  before insert or update of paciente_id, clinica_id on public.documento_consentimento
  for each row execute function app.garantir_paciente_da_clinica();

create trigger trg_paciente_da_clinica
  before insert or update of paciente_id, clinica_id on public.consulta
  for each row execute function app.garantir_paciente_da_clinica();
