import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";

/**
 * S3-1 — Funil comercial (orçamento). Testes obrigatórios (CLAUDE.md §5):
 *  (1) RLS isolamento entre clínicas; (2) RBAC por papel (profissional cria mas
 *  não deleta; papel de outra clínica é recusado pela RPC); (3) CÁLCULO
 *  financeiro (subtotal/desconto/valor_final via salvar_orcamento); + isolamento
 *  paciente↔clínica (trigger) e persistência de regiões (odontograma).
 */
describe.skipIf(!temAmbiente)("RLS/RBAC/cálculo: orçamento (S3-1)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emailPropA = `orc-prop-a-${sufixo}@teste.sigo`;
  const emailProfA = `orc-prof-a-${sufixo}@teste.sigo`;
  const emailPropB = `orc-prop-b-${sufixo}@teste.sigo`;
  const emailPacA = `orc-pac-a-${sufixo}@teste.sigo`;

  let admin: SupabaseClient;
  let clinicaA: string, clinicaB: string;
  let userPropA: string, userProfA: string, userPropB: string, userPacA: string;
  let pacienteA: string, pacienteB: string;
  let servicoA: string;
  let orcamentoPacA: string; // orçamento de pacienteA (para o portal do paciente)

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Orc A ${sufixo}`, tipo: "odontologica", exibir_marketplace: false },
        { nome: `Orc B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    [clinicaA, clinicaB] = clinicas!.map((c) => c.id);

    userPropA = await criarUsuario(admin, emailPropA, senha);
    userProfA = await criarUsuario(admin, emailProfA, senha);
    userPropB = await criarUsuario(admin, emailPropB, senha);
    await admin.from("clinica_usuario").insert([
      { clinica_id: clinicaA, user_id: userPropA, papel: "proprietario" },
      { clinica_id: clinicaA, user_id: userProfA, papel: "profissional" },
      { clinica_id: clinicaB, user_id: userPropB, papel: "proprietario" },
    ]);
    await admin
      .from("profissional")
      .insert({ clinica_id: clinicaA, nome: `Dr Orc ${sufixo}`, user_id: userProfA });

    // pacienteA tem login (portal); pacienteB pertence só à B (isolamento)
    userPacA = await criarUsuario(admin, emailPacA, senha);
    const { data: pacs } = await admin
      .from("paciente")
      .insert([
        { nome: `Pac Orc A ${sufixo}`, user_id: userPacA },
        { nome: `Pac Orc B ${sufixo}` },
      ])
      .select("id");
    [pacienteA, pacienteB] = pacs!.map((p) => p.id);
    await admin.from("paciente_clinica").insert([
      { clinica_id: clinicaA, paciente_id: pacienteA },
      { clinica_id: clinicaB, paciente_id: pacienteB },
    ]);

    const { data: serv } = await admin
      .from("servico")
      .insert({ clinica_id: clinicaA, nome: `Serviço Orc ${sufixo}` })
      .select("id")
      .single();
    servicoA = serv!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaA) await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    await admin.from("paciente").delete().in("id", [pacienteA, pacienteB]);
    for (const uid of [userPropA, userProfA, userPropB, userPacA]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  // ---- (3) CÁLCULO financeiro ------------------------------------------------

  it("salvar_orcamento calcula subtotal/desconto/valor_final (percentual)", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { data, error } = await sup.rpc("salvar_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento: {
        paciente_id: pacienteA,
        status: "aprovado",
        tipo_desconto: "percentual",
        desconto: 10,
        validade_dias: 30,
      },
      p_itens: [
        { servico_id: servicoA, quantidade: 2, valor_unitario: 100, tipo_valor: "fixo", regioes: [] },
        { servico_id: servicoA, quantidade: 1, valor_unitario: 0, tipo_valor: "gratuito", regioes: [] },
      ],
    });
    expect(error).toBeNull();
    orcamentoPacA = data as string;

    const { data: orc } = await sup
      .from("orcamento")
      .select("valor_total,desconto,valor_final,tipo_desconto")
      .eq("id", orcamentoPacA)
      .single();
    expect(Number(orc!.valor_total)).toBe(200); // 2×100 + gratuito(0)
    expect(Number(orc!.valor_final)).toBe(180); // -10%
  });

  it("desconto por valor recalcula valor_final (edição do mesmo orçamento)", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { error } = await sup.rpc("salvar_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento: {
        id: orcamentoPacA,
        paciente_id: pacienteA,
        status: "aprovado",
        tipo_desconto: "valor",
        desconto: 50,
      },
      p_itens: [
        { servico_id: servicoA, quantidade: 2, valor_unitario: 100, tipo_valor: "fixo", regioes: [] },
      ],
    });
    expect(error).toBeNull();
    const { data: orc } = await sup
      .from("orcamento")
      .select("valor_total,valor_final")
      .eq("id", orcamentoPacA)
      .single();
    expect(Number(orc!.valor_total)).toBe(200);
    expect(Number(orc!.valor_final)).toBe(150); // 200 - 50
  });

  it("regiões (odontograma) são persistidas em item_orcamento.regioes", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const { data: orcId, error } = await sup.rpc("salvar_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento: { cliente_nome: `Avulso Reg ${sufixo}`, status: "rascunho" },
      p_itens: [
        { servico_id: servicoA, quantidade: 1, valor_unitario: 300, tipo_valor: "fixo", regioes: ["11", "21"] },
      ],
    });
    expect(error).toBeNull();
    const { data: item } = await sup
      .from("item_orcamento")
      .select("regioes")
      .eq("orcamento_id", orcId as string)
      .single();
    expect(item!.regioes.sort()).toEqual(["11", "21"]);
  });

  // ---- Isolamento paciente↔clínica (trigger) --------------------------------

  it("recusa orçamento para paciente de OUTRA clínica; avulso passa", async () => {
    const sup = await clientLogado(emailPropA, senha);
    const proibido = await sup.rpc("salvar_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento: { paciente_id: pacienteB, status: "rascunho" }, // pacienteB só na B
      p_itens: [],
    });
    expect(proibido.error).not.toBeNull();
    expect(proibido.error!.code).toBe("23514");

    const avulso = await sup.rpc("salvar_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento: { cliente_nome: `Avulso OK ${sufixo}`, status: "rascunho" },
      p_itens: [],
    });
    expect(avulso.error).toBeNull();
  });

  // ---- (1) RLS isolamento entre clínicas ------------------------------------

  it("clínica B não enxerga orçamentos da A", async () => {
    const supB = await clientLogado(emailPropB, senha);
    const { data } = await supB
      .from("orcamento")
      .select("id,clinica_id")
      .in("clinica_id", [clinicaA, clinicaB]);
    expect((data ?? []).every((o) => o.clinica_id === clinicaB)).toBe(true);
  });

  it("proprietário da A não insere orçamento direto na B (WITH CHECK)", async () => {
    const supA = await clientLogado(emailPropA, senha);
    const { error } = await supA
      .from("orcamento")
      .insert({ clinica_id: clinicaB, cliente_nome: "x", status: "rascunho" });
    expect(error).not.toBeNull();
  });

  // ---- (2) RBAC por papel ----------------------------------------------------

  it("profissional CRIA orçamento mas NÃO deleta", async () => {
    const supProf = await clientLogado(emailProfA, senha);
    const { data: novoId, error } = await supProf.rpc("salvar_orcamento", {
      p_clinica_id: clinicaA,
      p_orcamento: { cliente_nome: `Prof cria ${sufixo}`, status: "rascunho" },
      p_itens: [],
    });
    expect(error).toBeNull();

    const del = await supProf.from("orcamento").delete().eq("id", novoId as string).select("id");
    // RLS delete exclui profissional → erro OU zero linhas afetadas
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    const { data: aindaExiste } = await admin
      .from("orcamento")
      .select("id")
      .eq("id", novoId as string)
      .maybeSingle();
    expect(aindaExiste).not.toBeNull();
  });

  it("papel de outra clínica é recusado pela RPC (42501)", async () => {
    const supB = await clientLogado(emailPropB, senha);
    const { error } = await supB.rpc("salvar_orcamento", {
      p_clinica_id: clinicaA, // B não tem papel na A
      p_orcamento: { cliente_nome: "hack", status: "rascunho" },
      p_itens: [],
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  // ---- Portal do paciente ----------------------------------------------------

  it("paciente logado vê o PRÓPRIO orçamento", async () => {
    const supPac = await clientLogado(emailPacA, senha);
    const { data } = await supPac
      .from("orcamento")
      .select("id,paciente_id")
      .eq("id", orcamentoPacA)
      .maybeSingle();
    expect(data).not.toBeNull();
    expect(data!.paciente_id).toBe(pacienteA);
  });
});
