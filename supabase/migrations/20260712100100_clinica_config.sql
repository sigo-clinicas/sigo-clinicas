-- =============================================================================
-- 1200 CONFIG OPERACIONAL DA CLÍNICA (S1-3)
-- Preferências da tela de Configurações do Base44 que lá viviam em
-- localStorage (ClinicaContext): base de cálculo de comissão, lembretes
-- automáticos, canais de envio e origens de pacientes.
--
-- jsonb consciente (não é a desnormalização A3): são preferências de
-- operação sem integridade relacional a garantir. Estrutura:
-- {
--   "base_comissao": "por_agendamento" | "por_evolucao",
--   "lembretes": { "h24": true, "h12": false, "h2": true },
--   "canais":    { "whatsapp": true, "sms": false, "email": true },
--   "origens_pacientes": [ { "nome": "Instagram", "cor": "bg-pink-100 text-pink-700" }, ... ]
-- }
-- A RPC de comissão (S3) lê base_comissao daqui.
-- =============================================================================

alter table public.clinica
  add column config jsonb not null default '{}'::jsonb;
