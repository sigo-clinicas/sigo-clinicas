import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientAnon,
  clientLogado,
  clientServiceRole,
  criarUsuario,
  env,
  temAmbiente,
} from "./helpers";

/**
 * S2-4 (DoD — a slice NÃO fecha sem isto): suíte de segurança do token da
 * anamnese pública. Cobre a Edge Function `anamnese-publica` (acesso por token,
 * sem login, service_role escopado por .eq('token')) + a RLS da tabela
 * resposta_anamnese (sem policy anon). Baseada no threat model adversarial:
 * isolamento por token, uuid inexistente→404, não-uuid→400 antes da query,
 * expirado→410, já-preenchido→409, duplo-submit concorrente, revalidação
 * server-side, whitelist anti-mass-assignment, e leitura direta barrada.
 */
describe.skipIf(!temAmbiente)("Segurança: anamnese pública por token (S2-4)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const EDGE = `${env.url}/functions/v1/anamnese-publica`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let clinicaB: string;
  let formularioA: string;
  let pacienteA: string;
  let pacienteB: string;
  let userPacienteA: string;
  let userStaffB: string;

  const emailPacA = `an-pac-a-${sufixo}@teste.sigo`;
  const emailStaffB = `an-staff-b-${sufixo}@teste.sigo`;

  const PERGUNTAS = [
    { id: "q1", texto: "Nome completo?", tipo: "texto", obrigatoria: true },
    { id: "q2", texto: "Alergias?", tipo: "texto_longo", obrigatoria: false },
  ];

  async function edge(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    const r = await fetch(EDGE, {
      method: "POST",
      headers: { apikey: env.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let json: Record<string, unknown> = {};
    try {
      json = await r.json();
    } catch {
      /* respostas sem corpo */
    }
    return { status: r.status, json };
  }

  /** Cria uma resposta_anamnese (via service role) e devolve o token. */
  async function novaResposta(
    clinica: string,
    paciente: string,
    opts: { status?: "pendente" | "preenchido"; expira_em?: string | null; respostas?: unknown } = {}
  ): Promise<string> {
    const token = crypto.randomUUID();
    // respostas é NOT NULL default '[]' — só seta se fornecido (nunca null).
    const row: Record<string, unknown> = {
      clinica_id: clinica,
      formulario_id: formularioA,
      paciente_id: paciente,
      token,
      status: opts.status ?? "pendente",
      expira_em: opts.expira_em ?? null,
    };
    if (opts.respostas !== undefined) row.respostas = opts.respostas;
    const { error } = await admin.from("resposta_anamnese").insert(row);
    if (error) throw error;
    return token;
  }

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `Clínica An A ${sufixo}`, tipo: "medica", exibir_marketplace: false },
        { nome: `Clínica An B ${sufixo}`, tipo: "medica", exibir_marketplace: false },
      ])
      .select("id");
    [clinicaA, clinicaB] = clinicas!.map((c) => c.id);

    const { data: form } = await admin
      .from("formulario_anamnese")
      .insert({ clinica_id: clinicaA, nome: `Anamnese ${sufixo}`, perguntas: PERGUNTAS })
      .select("id")
      .single();
    formularioA = form!.id;

    // paciente A tem login (para a policy select_paciente); paciente B não
    userPacienteA = await criarUsuario(admin, emailPacA, senha);
    const { data: pacA } = await admin
      .from("paciente")
      .insert({ nome: `Paciente An A ${sufixo}`, user_id: userPacienteA })
      .select("id")
      .single();
    pacienteA = pacA!.id;
    const { data: pacB } = await admin
      .from("paciente")
      .insert({ nome: `Paciente An B ${sufixo}` })
      .select("id")
      .single();
    pacienteB = pacB!.id;
    await admin.from("paciente_clinica").insert([
      { clinica_id: clinicaA, paciente_id: pacienteA },
      { clinica_id: clinicaB, paciente_id: pacienteB },
    ]);

    userStaffB = await criarUsuario(admin, emailStaffB, senha);
    await admin
      .from("clinica_usuario")
      .insert({ clinica_id: clinicaB, user_id: userStaffB, papel: "proprietario" });
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("clinica").delete().in("id", [clinicaA, clinicaB]);
    await admin.from("paciente").delete().in("id", [pacienteA, pacienteB]);
    for (const uid of [userPacienteA, userStaffB]) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
  });

  // ---- Edge Function: get ----------------------------------------------------

  it("get: token válido devolve a ficha e o formulário (só a linha do token)", async () => {
    const token = await novaResposta(clinicaA, pacienteA);
    const { status, json } = await edge({ action: "get", token });
    expect(status).toBe(200);
    expect((json.formulario as { nome?: string })?.nome).toContain("Anamnese");
    expect(json.paciente_nome).toContain("Paciente An A");
    expect(json.already_filled).toBe(false);
  });

  it("get: token não-UUID → 400 (antes de qualquer query)", async () => {
    const { status, json } = await edge({ action: "get", token: "nao-e-uuid' OR '1'='1" });
    expect(status).toBe(400);
    expect(json.error).toBe("invalid_token");
  });

  it("get: UUID válido inexistente → 404", async () => {
    const { status, json } = await edge({ action: "get", token: crypto.randomUUID() });
    expect(status).toBe(404);
    expect(json.error).toBe("not_found");
  });

  it("get: token expirado → 410", async () => {
    const passado = new Date(Date.now() - 3600_000).toISOString();
    const token = await novaResposta(clinicaA, pacienteA, { expira_em: passado });
    const { status, json } = await edge({ action: "get", token });
    expect(status).toBe(410);
    expect(json.error).toBe("expired");
  });

  it("get: ficha já preenchida → 200 read-only (already_filled)", async () => {
    const token = await novaResposta(clinicaA, pacienteA, {
      status: "preenchido",
      respostas: [{ pergunta_id: "q1", resposta: "Fulano" }],
    });
    const { status, json } = await edge({ action: "get", token });
    expect(status).toBe(200);
    expect(json.already_filled).toBe(true);
    expect(Array.isArray(json.respostas)).toBe(true);
  });

  it("get: token type-confusion (null/número) → 400 sem tocar o banco", async () => {
    expect((await edge({ action: "get", token: null })).status).toBe(400);
    expect((await edge({ action: "get", token: 123 })).status).toBe(400);
    expect((await edge({ action: "get", token: ["x"] })).status).toBe(400);
  });

  // ---- Edge Function: submit -------------------------------------------------

  it("submit: faltando obrigatória → 422, nada gravado", async () => {
    const token = await novaResposta(clinicaA, pacienteA);
    const { status, json } = await edge({
      action: "submit",
      token,
      respostas: [{ pergunta_id: "q2", resposta: "nenhuma" }], // q1 obrigatória faltando
    });
    expect(status).toBe(422);
    expect(json.error).toBe("missing_required");
    const { data } = await admin.from("resposta_anamnese").select("status").eq("token", token).single();
    expect(data!.status).toBe("pendente");
  });

  it("submit: válido grava e fecha a ficha; campo extra é descartado (whitelist)", async () => {
    const token = await novaResposta(clinicaA, pacienteA);
    const { status } = await edge({
      action: "submit",
      token,
      respostas: [
        { pergunta_id: "q1", resposta: "Fulano de Tal" },
        { pergunta_id: "__injetado", resposta: "hack" }, // fora do schema
      ],
    });
    expect(status).toBe(200);
    const { data } = await admin
      .from("resposta_anamnese")
      .select("status,data_preenchimento,respostas")
      .eq("token", token)
      .single();
    expect(data!.status).toBe("preenchido");
    expect(data!.data_preenchimento).not.toBeNull();
    const ids = (data!.respostas as { pergunta_id: string }[]).map((r) => r.pergunta_id);
    expect(ids).toContain("q1");
    expect(ids).not.toContain("__injetado"); // mass-assignment barrado
  });

  it("submit: não sobrescreve identidade (clinica_id/paciente_id do corpo ignorados)", async () => {
    const token = await novaResposta(clinicaA, pacienteA);
    await edge({
      action: "submit",
      token,
      respostas: [{ pergunta_id: "q1", resposta: "X" }],
      clinica_id: clinicaB,
      paciente_id: pacienteB,
      status: "pendente",
    });
    const { data } = await admin
      .from("resposta_anamnese")
      .select("clinica_id,paciente_id")
      .eq("token", token)
      .single();
    expect(data!.clinica_id).toBe(clinicaA);
    expect(data!.paciente_id).toBe(pacienteA);
  });

  it("submit: já-preenchida → 409, respostas inalteradas", async () => {
    const token = await novaResposta(clinicaA, pacienteA, {
      status: "preenchido",
      respostas: [{ pergunta_id: "q1", resposta: "original" }],
    });
    const { status } = await edge({
      action: "submit",
      token,
      respostas: [{ pergunta_id: "q1", resposta: "sobrescrito" }],
    });
    expect(status).toBe(409);
    const { data } = await admin.from("resposta_anamnese").select("respostas").eq("token", token).single();
    expect((data!.respostas as { resposta: string }[])[0].resposta).toBe("original");
  });

  it("submit: expirado-porém-pendente NÃO grava (revalidado no submit) → 410", async () => {
    const passado = new Date(Date.now() - 3600_000).toISOString();
    const token = await novaResposta(clinicaA, pacienteA, { expira_em: passado });
    const { status } = await edge({
      action: "submit",
      token,
      respostas: [{ pergunta_id: "q1", resposta: "X" }],
    });
    expect(status).toBe(410);
    const { data } = await admin.from("resposta_anamnese").select("status").eq("token", token).single();
    expect(data!.status).toBe("pendente");
  });

  it("submit: respostas não-array → 400", async () => {
    const token = await novaResposta(clinicaA, pacienteA);
    expect((await edge({ action: "submit", token, respostas: null })).status).toBe(400);
    expect((await edge({ action: "submit", token, respostas: "texto" })).status).toBe(400);
  });

  it("submit: duplo-submit concorrente — exatamente um vence (200), o outro 409", async () => {
    const token = await novaResposta(clinicaA, pacienteA);
    const [r1, r2] = await Promise.all([
      edge({ action: "submit", token, respostas: [{ pergunta_id: "q1", resposta: "A" }] }),
      edge({ action: "submit", token, respostas: [{ pergunta_id: "q1", resposta: "B" }] }),
    ]);
    const oks = [r1, r2].filter((r) => r.status === 200).length;
    const conflitos = [r1, r2].filter((r) => r.status === 409).length;
    expect(oks).toBe(1);
    expect(conflitos).toBe(1);
    const { data } = await admin.from("resposta_anamnese").select("status").eq("token", token).single();
    expect(data!.status).toBe("preenchido");
  });

  it("método != POST → 405", async () => {
    const r = await fetch(EDGE, { method: "GET", headers: { apikey: env.anonKey } });
    expect(r.status).toBe(405);
  });

  // ---- RLS direta (sem passar pela Edge) -------------------------------------

  it("anon key NÃO lê resposta_anamnese (sem policy anon)", async () => {
    const token = await novaResposta(clinicaA, pacienteA);
    const anon = clientAnon();
    const { data } = await anon.from("resposta_anamnese").select("id").eq("token", token);
    expect(data ?? []).toHaveLength(0);
  });

  it("staff de OUTRA clínica não lê a resposta da A (isolamento por tenant)", async () => {
    const token = await novaResposta(clinicaA, pacienteA);
    const supB = await clientLogado(emailStaffB, senha);
    const { data } = await supB.from("resposta_anamnese").select("id").eq("token", token);
    expect(data ?? []).toHaveLength(0);
  });

  it("paciente logado lê a PRÓPRIA anamnese, não a de outro paciente", async () => {
    const tokenProprio = await novaResposta(clinicaA, pacienteA);
    const tokenAlheio = await novaResposta(clinicaB, pacienteB);
    const sup = await clientLogado(emailPacA, senha);
    const { data: proprio } = await sup.from("resposta_anamnese").select("id").eq("token", tokenProprio);
    const { data: alheio } = await sup.from("resposta_anamnese").select("id").eq("token", tokenAlheio);
    expect(proprio ?? []).toHaveLength(1);
    expect(alheio ?? []).toHaveLength(0);
  });
});
