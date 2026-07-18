import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientServiceRole, temAmbiente } from "./helpers";

/**
 * S6 — agendar_publico v2 + constraint EXCLUDE. Cobre o que a auditoria apontou:
 *  - a RPC grava a DURAÇÃO REAL (soma dos serviços), não 30 literal;
 *  - sobreposição PARCIAL é barrada (era só igualdade exata de instante);
 *  - corrida público×painel: a constraint barra o overlap por QUALQUER caminho;
 *  - revalidação de janela na ESCRITA (POST fora do expediente era aceito).
 *
 * Fuso da clínica = America/Sao_Paulo (UTC-3). Helper `futuroLocal` devolve um
 * instante UTC ~1 semana à frente num dia/hora LOCAL específico.
 */
describe.skipIf(!temAmbiente)("S6 — agendar_publico v2 + EXCLUDE", () => {
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let admin: SupabaseClient;
  let clinica: string;
  let profLivre: string; // sem janela (aceita qualquer horário)
  let profJanela: string; // janela seg-sex 09:00-12:00
  let serv30: string, serv45: string;

  // instante UTC futuro que, no fuso SP (UTC-3), cai em (diaSemana, horaLocal).
  // Para horaLocal <= 20, horaLocal+3 < 24 → a data UTC preserva o dia local.
  function futuroLocal(diaSemana: number, horaLocal: number, minuto = 0): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 7);
    while (d.getUTCDay() !== diaSemana) d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(horaLocal + 3, minuto, 0, 0);
    return d.toISOString();
  }

  const args = (over: Record<string, unknown>) => ({
    p_clinica_id: clinica,
    p_profissional_id: profLivre,
    p_data_hora: futuroLocal(1, 10), // segunda 10:00 local (default)
    p_servico_ids: [],
    p_nome: `Paciente ${sufixo}`,
    p_telefone: "11999990000",
    p_email: "",
    p_cpf: "",
    p_obs: "",
    ...over,
  });

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: c } = await admin
      .from("clinica")
      .insert({ nome: `V2 ${sufixo}`, slug: `v2-${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: true })
      .select("id")
      .single();
    clinica = c!.id;

    // chaves uniformes em todas as linhas (PostgREST exige no bulk insert)
    const { data: profs, error: eProf } = await admin
      .from("profissional")
      .insert([
        {
          clinica_id: clinica, nome: `Livre ${sufixo}`, ativo: true,
          dias_atendimento: [], horario_inicio: null, horario_fim: null,
        },
        {
          clinica_id: clinica, nome: `Janela ${sufixo}`, ativo: true,
          dias_atendimento: [1, 2, 3, 4, 5], horario_inicio: "09:00", horario_fim: "12:00",
        },
      ])
      .select("id,nome");
    if (eProf) throw eProf;
    profLivre = profs!.find((p) => p.nome.startsWith("Livre"))!.id;
    profJanela = profs!.find((p) => p.nome.startsWith("Janela"))!.id;

    const { data: servs, error: eServ } = await admin
      .from("servico")
      .insert([
        { clinica_id: clinica, nome: `S30 ${sufixo}`, ativo: true, exibir_publico: true, duracao_minutos: 30 },
        { clinica_id: clinica, nome: `S45 ${sufixo}`, ativo: true, exibir_publico: true, duracao_minutos: 45 },
      ])
      .select("id,duracao_minutos");
    if (eServ) throw eServ;
    serv30 = servs!.find((s) => s.duracao_minutos === 30)!.id;
    serv45 = servs!.find((s) => s.duracao_minutos === 45)!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinica) await admin.from("clinica").delete().eq("id", clinica);
    await admin.from("paciente").delete().ilike("nome", `%${sufixo}%`);
  });

  it("grava a DURAÇÃO REAL = soma dos serviços (30 + 45 = 75)", async () => {
    const { data: id, error } = await admin.rpc("agendar_publico", args({
      p_data_hora: futuroLocal(1, 8), // 08:00 (evita colidir com outros testes)
      p_servico_ids: [serv30, serv45],
    }));
    expect(error).toBeNull();
    const { data: consulta } = await admin
      .from("consulta").select("duracao_minutos").eq("id", id as string).single();
    expect(consulta!.duracao_minutos).toBe(75);
  });

  // paciente já vinculado à clínica (o trigger app.garantir_paciente_da_clinica
  // exige o vínculo — senão barra com 23514 antes da EXCLUDE)
  async function pacienteLigado(nome: string): Promise<string> {
    const { data, error } = await admin.from("paciente").insert({ nome }).select("id").single();
    if (error) throw error;
    const { error: eV } = await admin
      .from("paciente_clinica")
      .insert({ clinica_id: clinica, paciente_id: data!.id });
    if (eV) throw eV;
    return data!.id;
  }

  it("barra SOBREPOSIÇÃO PARCIAL (não só igualdade exata de instante)", async () => {
    // consulta de 60min às 14:00 (via service_role, duracao real 60)
    const base = futuroLocal(2, 14); // terça 14:00
    const { error: eBase } = await admin.from("consulta").insert({
      clinica_id: clinica, profissional_id: profLivre,
      paciente_id: await pacienteLigado(`Base ${sufixo}`),
      data_hora: base, duracao_minutos: 60, status: "agendado",
    });
    expect(eBase).toBeNull();
    // agendar às 14:30 (30min) → [14:30,15:00) sobrepõe [14:00,15:00) → recusa
    const { error } = await admin.rpc("agendar_publico", args({ p_data_hora: futuroLocal(2, 14, 30) }));
    expect(error?.code).toBe("23514"); // 'horario ja ocupado' (traduzido do 23P01)
    expect(error?.message ?? "").toContain("ocupado");
  });

  it("corrida público×painel: a constraint barra o overlap por insert direto (23P01)", async () => {
    const base = futuroLocal(3, 15); // quarta 15:00, 30min via RPC
    const { error: e1 } = await admin.rpc("agendar_publico", args({ p_data_hora: base }));
    expect(e1).toBeNull();
    // insert DIRETO (caminho painel) sobrepondo, com paciente JÁ vinculado → a
    // EXCLUDE (não o trigger de tenant) dispara 23P01
    const { error: e2 } = await admin.from("consulta").insert({
      clinica_id: clinica, profissional_id: profLivre,
      paciente_id: await pacienteLigado(`Dir ${sufixo}`),
      data_hora: futuroLocal(3, 15, 15), duracao_minutos: 30, status: "agendado",
    });
    expect(e2?.code).toBe("23P01");
  });

  it("revalida a JANELA do profissional na escrita (fora do expediente é recusado)", async () => {
    // profJanela atende seg-sex 09-12. Booking na segunda 15:00 → fora → recusa.
    const fora = await admin.rpc("agendar_publico", args({
      p_profissional_id: profJanela, p_data_hora: futuroLocal(1, 15),
    }));
    expect(fora.error!.code).toBe("23514");

    // sábado (dia 6) não está em dias_atendimento → recusa
    const sabado = await admin.rpc("agendar_publico", args({
      p_profissional_id: profJanela, p_data_hora: futuroLocal(6, 10),
    }));
    expect(sabado.error!.code).toBe("23514");

    // dentro da janela (segunda 09:00) → aceita
    const dentro = await admin.rpc("agendar_publico", args({
      p_profissional_id: profJanela, p_data_hora: futuroLocal(1, 9),
    }));
    expect(dentro.error).toBeNull();
  });
});
