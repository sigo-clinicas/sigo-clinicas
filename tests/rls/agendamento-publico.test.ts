import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAnon, clientServiceRole, temAmbiente } from "./helpers";

/**
 * S3-8 — Agendamento público + lead. Testes: agendar_publico cria paciente
 * global + vínculo + consulta com clinica_id correto; recusa double-booking,
 * passado, clínica não-pública e profissional de outra clínica; dedup por CPF.
 * Lead: anon insere (captação sem login) mas NUNCA lê de volta.
 */
describe.skipIf(!temAmbiente)("Agendamento público + lead (S3-8)", () => {
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let admin: SupabaseClient;
  let clinicaPub: string, clinicaPriv: string;
  let profPub: string, profPriv: string;
  let servicoPub: string;

  const futuro = new Date(Date.now() + 7 * 86_400_000);
  futuro.setHours(10, 0, 0, 0);
  const dataHora = futuro.toISOString();
  const dataHora2 = new Date(futuro.getTime() + 3600_000).toISOString();
  const passado = new Date(Date.now() - 86_400_000).toISOString();
  const cpf = `${sufixo.replace(/\D/g, "").slice(0, 11).padEnd(11, "0")}`;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `AgPub ${sufixo}`, slug: `agpub-${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: true },
        { nome: `AgPriv ${sufixo}`, slug: `agpriv-${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: false },
      ])
      .select("id");
    [clinicaPub, clinicaPriv] = clinicas!.map((c) => c.id);

    const { data: profs } = await admin
      .from("profissional")
      .insert([
        { clinica_id: clinicaPub, nome: `Dr Pub ${sufixo}`, ativo: true },
        { clinica_id: clinicaPriv, nome: `Dr Priv ${sufixo}`, ativo: true },
      ])
      .select("id,clinica_id");
    profPub = profs!.find((p) => p.clinica_id === clinicaPub)!.id;
    profPriv = profs!.find((p) => p.clinica_id === clinicaPriv)!.id;

    const { data: serv } = await admin
      .from("servico")
      .insert({ clinica_id: clinicaPub, nome: `Serv ${sufixo}`, ativo: true, exibir_publico: true })
      .select("id")
      .single();
    servicoPub = serv!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaPub) await admin.from("clinica").delete().in("id", [clinicaPub, clinicaPriv]);
    await admin.from("paciente").delete().ilike("nome", `%${sufixo}%`);
    await admin.from("lead").delete().ilike("nome", `%${sufixo}%`);
  });

  it("agenda: cria paciente global + vínculo (marketplace) + consulta na clínica certa", async () => {
    const { data: consultaId, error } = await admin.rpc("agendar_publico", {
      p_clinica_id: clinicaPub,
      p_profissional_id: profPub,
      p_data_hora: dataHora,
      p_servico_ids: [servicoPub],
      p_nome: `Paciente ${sufixo}`,
      p_telefone: "11999990000",
      p_email: "p@x.com",
      p_cpf: cpf,
      p_obs: "via marketplace",
    });
    expect(error).toBeNull();

    const { data: consulta } = await admin
      .from("consulta")
      .select("clinica_id,paciente_id,profissional_id,status")
      .eq("id", consultaId as string)
      .single();
    expect(consulta!.clinica_id).toBe(clinicaPub);
    expect(consulta!.profissional_id).toBe(profPub);
    expect(consulta!.status).toBe("agendado");

    const { data: pac } = await admin
      .from("paciente").select("id,cpf").eq("id", consulta!.paciente_id).single();
    expect(pac!.cpf).toBe(cpf);
    const { data: vinculo } = await admin
      .from("paciente_clinica")
      .select("origem")
      .eq("clinica_id", clinicaPub)
      .eq("paciente_id", consulta!.paciente_id)
      .single();
    expect(vinculo!.origem).toBe("marketplace");
    const { count } = await admin
      .from("consulta_servico").select("id", { count: "exact", head: true }).eq("consulta_id", consultaId as string);
    expect(count).toBe(1);
  });

  it("mesmo CPF reaproveita o paciente global (dedup)", async () => {
    const { data: consultaId } = await admin.rpc("agendar_publico", {
      p_clinica_id: clinicaPub, p_profissional_id: profPub, p_data_hora: dataHora2,
      p_servico_ids: [], p_nome: `Paciente2 ${sufixo}`, p_telefone: "11999990000",
      p_email: "", p_cpf: cpf, p_obs: "",
    });
    const { count } = await admin
      .from("paciente").select("id", { count: "exact", head: true }).eq("cpf", cpf);
    expect(count).toBe(1); // não duplicou
    expect(consultaId).toBeTruthy();
  });

  it("recusa double-booking do mesmo horário", async () => {
    const { error } = await admin.rpc("agendar_publico", {
      p_clinica_id: clinicaPub, p_profissional_id: profPub, p_data_hora: dataHora,
      p_servico_ids: [], p_nome: `Outro ${sufixo}`, p_telefone: "11888880000",
      p_email: "", p_cpf: "", p_obs: "",
    });
    expect(error!.code).toBe("23514");
  });

  it("recusa passado, clínica não-pública e profissional de outra clínica", async () => {
    const r1 = await admin.rpc("agendar_publico", {
      p_clinica_id: clinicaPub, p_profissional_id: profPub, p_data_hora: passado,
      p_servico_ids: [], p_nome: `X ${sufixo}`, p_telefone: "1", p_email: "", p_cpf: "", p_obs: "",
    });
    expect(r1.error!.code).toBe("23514");

    const r2 = await admin.rpc("agendar_publico", {
      p_clinica_id: clinicaPriv, p_profissional_id: profPriv, p_data_hora: dataHora,
      p_servico_ids: [], p_nome: `X ${sufixo}`, p_telefone: "1", p_email: "", p_cpf: "", p_obs: "",
    });
    expect(r2.error!.code).toBe("23514"); // clínica não pública

    const r3 = await admin.rpc("agendar_publico", {
      p_clinica_id: clinicaPub, p_profissional_id: profPriv, p_data_hora: dataHora,
      p_servico_ids: [], p_nome: `X ${sufixo}`, p_telefone: "1", p_email: "", p_cpf: "", p_obs: "",
    });
    expect(r3.error!.code).toBe("23514"); // profissional de outra clínica
  });

  it("lead: anon insere (captação) mas NÃO lê de volta", async () => {
    const anon = clientAnon();
    const ins = await anon.from("lead").insert({
      clinica_id: clinicaPub, nome: `Lead ${sufixo}`, telefone: "11777770000",
      origem: "marketplace", status: "novo",
    });
    expect(ins.error).toBeNull();

    const { data } = await anon.from("lead").select("id").ilike("nome", `%${sufixo}%`);
    expect((data ?? []).length).toBe(0); // sem policy de select p/ anon
  });
});
