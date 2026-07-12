import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientLogado,
  clientServiceRole,
  criarUsuario,
  temAmbiente,
} from "./helpers";
import { limparStoragePaciente } from "@/lib/lgpd-storage";

/**
 * S2-5 (DoD): lógica LGPD.
 *  - GATE de consentimento (consentimento_vigente): sem TCLE assinado → false;
 *    com TCLE assinado e não revogado → true.
 *  - ANONIMIZAÇÃO (anonimizar_paciente, só admin): identificadores apagados,
 *    prontuário RETIDO intacto, Storage limpo, usuário/sessão encerrados,
 *    evento de accountability gravado.
 *  - SELF-SERVICE (abrir_solicitacao_lgpd): o titular logado abre o pedido; staff
 *    sem vínculo de paciente não abre.
 */
describe.skipIf(!temAmbiente)("LGPD: gate, anonimização e self-service (S2-5)", () => {
  const senha = "senha-de-teste-123!";
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let admin: SupabaseClient;
  let clinicaA: string;
  let userProp: string;
  let userAdmin: string;
  let userPacSelf: string;
  let userPacAnon: string;
  let pacGate: string;
  let pacSelf: string;
  let pacAnon: string;

  const emails = {
    prop: `lgpd-prop-${sufixo}@teste.sigo`,
    admin: `lgpd-admin-${sufixo}@teste.sigo`,
    pacSelf: `lgpd-pac-self-${sufixo}@teste.sigo`,
    pacAnon: `lgpd-pac-anon-${sufixo}@teste.sigo`,
  };
  const objAnon = () => `${clinicaA}/avaliacoes/${pacAnon}/anon-${sufixo}.txt`;

  beforeAll(async () => {
    admin = clientServiceRole();

    const { data: cl } = await admin
      .from("clinica")
      .insert({ nome: `Clínica LGPD ${sufixo}`, tipo: "medica", exibir_marketplace: false })
      .select("id")
      .single();
    clinicaA = cl!.id;

    userProp = await criarUsuario(admin, emails.prop, senha);
    userAdmin = await criarUsuario(admin, emails.admin, senha);
    userPacSelf = await criarUsuario(admin, emails.pacSelf, senha);
    userPacAnon = await criarUsuario(admin, emails.pacAnon, senha);
    await admin.from("clinica_usuario").insert({ clinica_id: clinicaA, user_id: userProp, papel: "proprietario" });
    await admin.from("admin_plataforma").insert({ user_id: userAdmin });

    const { data: pacs } = await admin
      .from("paciente")
      .insert([
        { nome: `Gate ${sufixo}` },
        { nome: `Self ${sufixo}`, user_id: userPacSelf },
        { nome: `Anon ${sufixo}`, cpf: "12345678900", email: "anon@x.com", user_id: userPacAnon },
      ])
      .select("id");
    [pacGate, pacSelf, pacAnon] = pacs!.map((p) => p.id);
    await admin.from("paciente_clinica").insert([
      { clinica_id: clinicaA, paciente_id: pacGate },
      { clinica_id: clinicaA, paciente_id: pacSelf },
      { clinica_id: clinicaA, paciente_id: pacAnon },
    ]);

    // pacAnon tem prontuário (deve ser RETIDO) + objeto de Storage (deve sumir)
    await admin.from("avaliacao_clinica").insert({
      clinica_id: clinicaA,
      paciente_id: pacAnon,
      queixa_principal: "registro clínico a reter",
    });
    await admin.storage
      .from("prontuario")
      .upload(objAnon(), new Blob(["x"], { type: "text/plain" }), { upsert: true });
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("clinica").delete().eq("id", clinicaA);
    await admin.from("paciente").delete().in("id", [pacGate, pacSelf, pacAnon]);
    // userPacAnon já foi apagado pela anonimização; os demais removemos aqui
    for (const uid of [userProp, userAdmin, userPacSelf]) {
      if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {});
    }
  });

  // ---- Gate de consentimento -------------------------------------------------

  it("gate: sem TCLE assinado → consentimento_vigente = false", async () => {
    const sup = await clientLogado(emails.prop, senha);
    const { data } = await sup.rpc("consentimento_vigente", {
      p_paciente_id: pacGate,
      p_clinica_id: clinicaA,
      p_tipo: "tcle",
    });
    expect(data).toBe(false);
  });

  it("gate: com TCLE assinado e não revogado → true; revogado → false", async () => {
    const { data: doc } = await admin
      .from("documento_consentimento")
      .insert({
        clinica_id: clinicaA,
        paciente_id: pacGate,
        tipo: "tcle",
        titulo: "TCLE",
        status: "assinado",
      })
      .select("id")
      .single();

    const sup = await clientLogado(emails.prop, senha);
    const vig = await sup.rpc("consentimento_vigente", {
      p_paciente_id: pacGate,
      p_clinica_id: clinicaA,
      p_tipo: "tcle",
    });
    expect(vig.data).toBe(true);

    // revoga → deixa de valer
    await admin
      .from("documento_consentimento")
      .update({ status: "revogado", data_revogacao: new Date().toISOString() })
      .eq("id", doc!.id);
    const vig2 = await sup.rpc("consentimento_vigente", {
      p_paciente_id: pacGate,
      p_clinica_id: clinicaA,
      p_tipo: "tcle",
    });
    expect(vig2.data).toBe(false);
  });

  // ---- Anonimização ----------------------------------------------------------

  it("anonimização: staff (não-admin) NÃO anonimiza → 42501", async () => {
    const sup = await clientLogado(emails.prop, senha);
    const { error } = await sup.rpc("anonimizar_paciente", { p_paciente_id: pacAnon, p_motivo: "teste" });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("anonimização: admin apaga identificadores, RETÉM prontuário, limpa Storage e encerra acesso", async () => {
    const sup = await clientLogado(emails.admin, senha);
    const { data: clinicas, error } = await sup.rpc("anonimizar_paciente", {
      p_paciente_id: pacAnon,
      p_motivo: "pedido do titular",
    });
    expect(error).toBeNull();

    // A limpeza de Storage roda fora da RPC (Storage API), como na Server Action.
    const removidos = await limparStoragePaciente(admin, pacAnon, (clinicas as string[]) ?? []);
    expect(removidos).toBeGreaterThanOrEqual(1);

    // identificadores apagados
    const { data: pac } = await admin
      .from("paciente")
      .select("nome,cpf,email,anonimizado,user_id,data_anonimizacao")
      .eq("id", pacAnon)
      .single();
    expect(pac!.anonimizado).toBe(true);
    expect(pac!.cpf).toBeNull();
    expect(pac!.email).toBeNull();
    expect(pac!.user_id).toBeNull();
    expect(pac!.nome).not.toContain("Anon");
    expect(pac!.data_anonimizacao).not.toBeNull();

    // prontuário RETIDO (registro clínico não é apagado)
    const { data: avals } = await admin
      .from("avaliacao_clinica")
      .select("id")
      .eq("paciente_id", pacAnon);
    expect(avals!.length).toBe(1);

    // Storage limpo
    const { data: obj } = await admin.storage
      .from("prontuario")
      .list(`${clinicaA}/avaliacoes/${pacAnon}`);
    expect((obj ?? []).length).toBe(0);

    // acesso encerrado: usuário de auth removido
    const { data: u } = await admin.auth.admin.getUserById(userPacAnon);
    expect(u.user).toBeNull();

    // accountability
    const { data: ev } = await admin
      .from("consentimento_evento")
      .select("tipo,origem")
      .eq("paciente_id", pacAnon)
      .eq("tipo", "anonimizacao");
    expect((ev ?? []).length).toBeGreaterThanOrEqual(1);
    expect(ev![0].origem).toBe("admin");
  });

  // ---- Self-service ----------------------------------------------------------

  it("self-service: titular logado abre pedido de exportação (origem self)", async () => {
    const sup = await clientLogado(emails.pacSelf, senha);
    const { error } = await sup.rpc("abrir_solicitacao_lgpd", {
      p_tipo: "exportacao",
      p_detalhe: "quero meus dados",
    });
    expect(error).toBeNull();

    const { data: ev } = await admin
      .from("consentimento_evento")
      .select("tipo,origem")
      .eq("paciente_id", pacSelf)
      .eq("tipo", "exportacao");
    expect((ev ?? []).length).toBe(1);
    expect(ev![0].origem).toBe("self");
  });

  it("self-service: quem não é titular (staff) não abre pedido → 42501", async () => {
    const sup = await clientLogado(emails.prop, senha);
    const { error } = await sup.rpc("abrir_solicitacao_lgpd", {
      p_tipo: "exclusao",
      p_detalhe: "x",
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });
});
