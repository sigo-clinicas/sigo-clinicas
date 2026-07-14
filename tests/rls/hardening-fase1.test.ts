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

  // Regressão do grant (0028): NENHUMA RPC SECURITY DEFINER é executável pelo
  // `anon`. Params corretos de propósito — assim o ÚNICO motivo de falha é a
  // ausência de EXECUTE (não erro de assinatura). `error.code` é o SQLSTATE
  // 42501 (permission denied) que o PostgREST propaga; nunca PGRST202 (função
  // não encontrada). Cobre endpoint público (agendar_publico, só service_role)
  // e todas as famílias de RPC de tenant (financeiro, comercial, comissão,
  // estoque, paciente, LGPD, convênio, relatório).
  const NIL = "00000000-0000-0000-0000-000000000000";
  const RPCS_SECDEF: { nome: string; args: Record<string, unknown> }[] = [
    { nome: "agendar_publico", args: { p_clinica_id: NIL, p_profissional_id: NIL, p_data_hora: "2026-08-01T10:00:00Z", p_servico_ids: [], p_nome: "x", p_telefone: "1", p_email: "", p_cpf: "", p_obs: "" } },
    { nome: "registrar_baixa_lancamento", args: { p_clinica_id: NIL, p_lancamento_id: NIL, p_conta_id: NIL, p_valor: 1, p_data: "2026-07-01", p_forma: "pix", p_obs: "" } },
    { nome: "estornar_baixa_lancamento", args: { p_clinica_id: NIL, p_baixa_id: NIL } },
    { nome: "vender_orcamento", args: { p_clinica_id: NIL, p_orcamento_id: NIL, p_forma_pagamento: "pix", p_data_venda: "2026-07-01", p_parcelas: [] } },
    { nome: "salvar_orcamento", args: { p_clinica_id: NIL, p_orcamento: {}, p_itens: [] } },
    { nome: "apurar_comissao", args: { p_clinica_id: NIL, p_profissional_id: NIL, p_competencia: "2026-07-01", p_vencimento: "2026-07-31", p_categoria_id: NIL, p_itens: [] } },
    { nome: "cancelar_apuracao_comissao", args: { p_clinica_id: NIL, p_lancamento_id: NIL } },
    { nome: "registrar_saida_estoque", args: { p_clinica_id: NIL, p_data: "2026-07-01", p_observacao: "", p_linhas: [] } },
    { nome: "salvar_paciente_clinica", args: { p_clinica_id: NIL, p_paciente_id: NIL, p_dados: {}, p_vinculo: {} } },
    { nome: "anonimizar_paciente", args: { p_paciente_id: NIL, p_motivo: "" } },
    { nome: "abrir_solicitacao_lgpd", args: { p_tipo: "acesso", p_detalhe: "" } },
    { nome: "gerar_recebiveis_convenio", args: { p_clinica_id: NIL, p_convenio_id: NIL, p_ini: "2026-07-01", p_fim: "2026-07-31" } },
    { nome: "registrar_baixa_lote_convenio", args: { p_clinica_id: NIL, p_conta_id: NIL, p_forma: "pix", p_data: "2026-07-01", p_itens: [] } },
    { nome: "relatorio_dashboard", args: { p_clinica_id: NIL, p_ini: "2026-07-01", p_fim: "2026-07-31" } },
  ];

  it.each(RPCS_SECDEF)("anon NÃO executa a RPC SECURITY DEFINER $nome (42501)", async ({ nome, args }) => {
    const anon = clientAnon();
    const { error } = await anon.rpc(nome, args);
    expect(error).not.toBeNull(); // sem privilégio de EXECUTE
    expect(error!.code).not.toBe("PGRST202"); // achou a função; negou por permissão
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

  it("rate-limit: a janela RESETA após expirar (contador volta a liberar)", async () => {
    // janela curta (1s) + limite 1: 1ª libera, 2ª bloqueia, após >1s a janela
    // expira e a 3ª libera de novo — exercita o ramo de RESET da fixed window.
    const chave = `test-reset:${sufixo}`;
    expect((await admin.rpc("consumir_rate_limit", { p_chave: chave, p_limite: 1, p_janela_seg: 1 })).data).toBe(true);
    expect((await admin.rpc("consumir_rate_limit", { p_chave: chave, p_limite: 1, p_janela_seg: 1 })).data).toBe(false);
    await new Promise((r) => setTimeout(r, 1200));
    expect((await admin.rpc("consumir_rate_limit", { p_chave: chave, p_limite: 1, p_janela_seg: 1 })).data).toBe(true);
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

  it("purga LGPD: exige prazo; dry_run CONTA sem apagar; destrutivo APAGA", async () => {
    // (1) sem prazo → erro (não roda com retenção "chutada")
    const semPrazo = await admin.rpc("purgar_por_retencao", { p_retencao_dias: null, p_dry_run: true });
    expect(semPrazo.error).not.toBeNull();

    // semeia um lead ANTIGO (2020) — capturado por qualquer retenção de 30 dias
    const marca = `purga-${sufixo}`;
    const { data: leadIns, error: insErr } = await admin
      .from("lead")
      .insert({
        clinica_id: null, nome: marca, telefone: "11999990000",
        origem: "marketplace", status: "novo", created_at: "2020-01-01T00:00:00Z",
      })
      .select("id")
      .single();
    expect(insErr).toBeNull();
    const leadId = leadIns!.id;

    // (2) dry_run: conta >=1 e o lead PERMANECE (prova que não é tautologia)
    const dry = await admin.rpc("purgar_por_retencao", { p_retencao_dias: 30, p_dry_run: true });
    expect(dry.error).toBeNull();
    const rd = dry.data as { dry_run: boolean; leads: number };
    expect(rd.dry_run).toBe(true);
    expect(Number(rd.leads)).toBeGreaterThanOrEqual(1);
    const aindaLa = await admin.from("lead").select("id").eq("id", leadId).maybeSingle();
    expect(aindaLa.data).not.toBeNull(); // dry_run NÃO apagou

    // (3) destrutivo: o lead antigo some (prova a diferença de comportamento)
    const del = await admin.rpc("purgar_por_retencao", { p_retencao_dias: 30, p_dry_run: false });
    expect(del.error).toBeNull();
    const sumiu = await admin.from("lead").select("id").eq("id", leadId).maybeSingle();
    expect(sumiu.data).toBeNull(); // p_dry_run=false apagou
  });
});
