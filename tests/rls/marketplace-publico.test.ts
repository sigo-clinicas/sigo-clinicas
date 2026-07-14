import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAnon, clientServiceRole, temAmbiente } from "./helpers";

/**
 * S3-7 — Marketplace público. Teste-CHAVE: o público (anon) só enxerga o que é
 * público (clínica exibir_marketplace, serviço exibir_publico) e NUNCA dados de
 * paciente/financeiro. Também: ranqueamento reflete o score.
 */
describe.skipIf(!temAmbiente)("Marketplace público (S3-7)", () => {
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let admin: SupabaseClient;
  let pub1: string, pub2: string, priv: string;
  let pacienteId: string;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `MPub1 ${sufixo}`, slug: `mpub1-${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: true },
        { nome: `MPub2 ${sufixo}`, slug: `mpub2-${sufixo}`, tipo: "estetica", ativo: true, exibir_marketplace: true },
        { nome: `MPriv ${sufixo}`, slug: `mpriv-${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: false },
      ])
      .select("id");
    [pub1, pub2, priv] = clinicas!.map((c) => c.id);

    // pub2 com destaque (score 10)
    await admin.from("clinica_destaque").insert({ clinica_id: pub2, nivel: "premium", score_manual: 10 });

    // pub1: serviço público + serviço privado
    await admin.from("servico").insert([
      { clinica_id: pub1, nome: `Público ${sufixo}`, ativo: true, exibir_publico: true },
      { clinica_id: pub1, nome: `Interno ${sufixo}`, ativo: true, exibir_publico: false },
    ]);

    // dados sensíveis em pub1 (NÃO podem vazar)
    const { data: pac } = await admin.from("paciente").insert({ nome: `Sig ${sufixo}` }).select("id").single();
    pacienteId = pac!.id;
    await admin.from("paciente_clinica").insert({ clinica_id: pub1, paciente_id: pacienteId });
    await admin.from("orcamento").insert({ clinica_id: pub1, cliente_nome: "Secreto", status: "aprovado", valor_total: 500, valor_final: 500 });
    await admin.from("lancamento_financeiro").insert({ clinica_id: pub1, tipo: "receita", descricao: "Secreto", valor: 500, data_vencimento: "2026-07-14" });
    const { data: prof } = await admin
      .from("profissional").insert({ clinica_id: pub1, nome: `Prof ${sufixo}` }).select("id").single();
    await admin.from("consulta").insert({
      clinica_id: pub1, paciente_id: pacienteId, profissional_id: prof!.id,
      data_hora: "2026-07-10T14:00:00Z", status: "agendado", duracao_minutos: 30,
    });
  });

  afterAll(async () => {
    if (!admin) return;
    if (pub1) await admin.from("clinica").delete().in("id", [pub1, pub2, priv]);
    await admin.from("paciente").delete().eq("id", pacienteId);
  });

  it("anon vê só clínicas públicas na view do marketplace", async () => {
    const anon = clientAnon();
    const { data } = await anon
      .from("marketplace_clinica")
      .select("id,nome")
      .in("id", [pub1, pub2, priv]);
    const ids = (data ?? []).map((c) => c.id);
    expect(ids).toContain(pub1);
    expect(ids).toContain(pub2);
    expect(ids).not.toContain(priv);
  });

  it("anon vê só serviço com exibir_publico", async () => {
    const anon = clientAnon();
    const { data } = await anon
      .from("servico")
      .select("nome,exibir_publico")
      .eq("clinica_id", pub1);
    expect((data ?? []).length).toBe(1);
    expect(data![0].exibir_publico).toBe(true);
  });

  it("anon NUNCA lê dados de paciente/financeiro/clínico", async () => {
    const anon = clientAnon();
    for (const tabela of [
      "paciente",
      "consulta",
      "orcamento",
      "venda",
      "pagamento",
      "lancamento_financeiro",
      "movimentacao_conta",
      "comissao",
      "resposta_anamnese",
      "avaliacao_clinica",
    ] as const) {
      const { data } = await anon.from(tabela).select("id").limit(5);
      expect((data ?? []).length).toBe(0);
    }
  });

  it("ranqueamento reflete o score (pub2 > pub1)", async () => {
    const anon = clientAnon();
    const { data } = await anon
      .from("marketplace_clinica")
      .select("id,ranking")
      .in("id", [pub1, pub2]);
    const r = new Map((data ?? []).map((c) => [c.id, Number(c.ranking)]));
    expect(r.get(pub2)).toBe(10);
    expect(r.get(pub1)).toBe(0);
    expect(r.get(pub2)!).toBeGreaterThan(r.get(pub1)!);
  });
});
