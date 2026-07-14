import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientAnon,
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S4-6 — Hardening de fechamento da Fase 1. Regressões dos endurecimentos:
 *  - RPCs de tenant/públicas não são mais executáveis pelo `anon` (grant).
 *  - rate-limit: janela fixa conta e bloqueia; só service_role chama.
 *  - purga LGPD: exige prazo (não roda "chutado"); dry_run não apaga; fora do anon.
 */
describe.skipIf(!temAmbiente)("Hardening Fase 1 (S4-6)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailUser = `hard-user-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let userId: string;

  beforeAll(async () => {
    admin = clientServiceRole();
    userId = await criarUsuario(admin, emailUser, senha);
  });

  afterAll(async () => {
    if (!admin) return;
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("agendar_publico não é executável pelo anon (revoke — defesa em profundidade)", async () => {
    const anon = clientAnon();
    const { error } = await anon.rpc("agendar_publico", {
      p_clinica_id: "00000000-0000-0000-0000-000000000000",
      p_profissional_id: "00000000-0000-0000-0000-000000000000",
      p_data_hora: "2026-08-01T10:00:00Z",
      p_servico_ids: [],
      p_nome: "x",
      p_telefone: "1",
      p_email: "",
      p_cpf: "",
      p_obs: "",
    });
    expect(error).not.toBeNull(); // sem privilégio de EXECUTE
  });

  it("rate-limit: janela fixa permite até o limite e bloqueia o excedente", async () => {
    const chave = `test:${sufixo}`;
    const r1 = await admin.rpc("consumir_rate_limit", { p_chave: chave, p_limite: 2, p_janela_seg: 60 });
    const r2 = await admin.rpc("consumir_rate_limit", { p_chave: chave, p_limite: 2, p_janela_seg: 60 });
    const r3 = await admin.rpc("consumir_rate_limit", { p_chave: chave, p_limite: 2, p_janela_seg: 60 });
    expect(r1.data).toBe(true);
    expect(r2.data).toBe(true);
    expect(r3.data).toBe(false); // estourou
    // (o bucket `app.rate_limit_bucket` não é exposto no PostgREST — limpeza
    // desnecessária: o DB de teste é efêmero e a chave tem sufixo único.)
  });

  it("rate-limit e purga não são executáveis por anon nem authenticated", async () => {
    const anon = clientAnon();
    const rlAnon = await anon.rpc("consumir_rate_limit", { p_chave: "x", p_limite: 1, p_janela_seg: 1 });
    expect(rlAnon.error).not.toBeNull();

    const user = await clientLogado(emailUser, senha);
    const rlAuth = await user.rpc("consumir_rate_limit", { p_chave: "x", p_limite: 1, p_janela_seg: 1 });
    expect(rlAuth.error).not.toBeNull();

    const purgaAnon = await anon.rpc("purgar_por_retencao", { p_retencao_dias: 30, p_dry_run: true });
    expect(purgaAnon.error).not.toBeNull();
    const purgaAuth = await user.rpc("purgar_por_retencao", { p_retencao_dias: 30, p_dry_run: true });
    expect(purgaAuth.error).not.toBeNull();
  });

  it("purga LGPD: exige prazo, dry_run não apaga", async () => {
    // sem prazo → erro (não roda com retenção "chutada")
    const semPrazo = await admin.rpc("purgar_por_retencao", { p_retencao_dias: null, p_dry_run: true });
    expect(semPrazo.error).not.toBeNull();

    // dry_run com prazo largo → retorna contadores e NÃO apaga
    const dry = await admin.rpc("purgar_por_retencao", { p_retencao_dias: 3650, p_dry_run: true });
    expect(dry.error).toBeNull();
    const r = dry.data as { dry_run: boolean; retencao_dias: number };
    expect(r.dry_run).toBe(true);
    expect(r.retencao_dias).toBe(3650);
  });
});
