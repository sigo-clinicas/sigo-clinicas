"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { profissionalDisponivel } from "@/lib/disponibilidade";

/**
 * S1-8 — Agenda. Escrita: proprietário/gerente/recepcionista/assistente
 * (matriz do legado — profissional só lê e altera status das próprias). O
 * RLS de consulta/consulta_servico é a garantia final. A validação de
 * conflito (choque de horário + fora da janela do profissional) roda no
 * servidor, mas NÃO substitui o RLS.
 */

export type ConsultaInput = {
  id?: string;
  paciente_id: string;
  profissional_id: string;
  convenio_id?: string | null;
  data_hora: string; // ISO local "yyyy-MM-ddTHH:mm"
  duracao_minutos: number;
  tipo: "consulta" | "retorno" | "exame" | "procedimento";
  status:
    | "agendado"
    | "confirmado"
    | "em_atendimento"
    | "concluido"
    | "cancelado"
    | "faltou";
  valor?: number | null;
  observacoes?: string | null;
  servico_ids: string[];
};

export type EstadoConsulta = { erro: string | null; ok?: boolean };

const PAPEIS_AGENDA = [
  "proprietario",
  "gerente",
  "recepcionista",
  "assistente",
];

export async function salvarConsulta(
  input: ConsultaInput
): Promise<EstadoConsulta> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };
  if (!PAPEIS_AGENDA.includes(sessao.papel ?? "") && !sessao.isAdmin) {
    return { erro: "Sem permissão para agendar." };
  }
  if (!input.paciente_id || !input.profissional_id || !input.data_hora) {
    return { erro: "Paciente, profissional e data/hora são obrigatórios." };
  }

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;
  const inicio = new Date(input.data_hora);
  const duracao = input.duracao_minutos || 30;

  // Disponibilidade do profissional (janela + intervalos)
  const { data: prof } = await supabase
    .from("profissional")
    .select(
      `dias_atendimento,horario_inicio,horario_fim,
       profissional_intervalo(tipo,dia_semana,hora_inicio,hora_fim,data_hora_inicio,data_hora_fim)`
    )
    .eq("id", input.profissional_id)
    .eq("clinica_id", clinicaId)
    .single();

  if (
    prof &&
    input.status !== "cancelado" &&
    !profissionalDisponivel(
      {
        dias_atendimento: prof.dias_atendimento,
        horario_inicio: prof.horario_inicio,
        horario_fim: prof.horario_fim,
        intervalos: prof.profissional_intervalo,
      },
      inicio,
      duracao
    )
  ) {
    return {
      erro: "O profissional não atende neste horário (fora da janela ou em bloqueio).",
    };
  }

  // Conflito com outra consulta do mesmo profissional (sobreposição)
  const fim = new Date(inicio.getTime() + duracao * 60000);
  const janelaIni = new Date(inicio.getTime() - 4 * 3600000).toISOString();
  const janelaFim = fim.toISOString();
  const { data: existentes } = await supabase
    .from("consulta")
    .select("id,data_hora,duracao_minutos")
    .eq("clinica_id", clinicaId)
    .eq("profissional_id", input.profissional_id)
    .neq("status", "cancelado")
    .gte("data_hora", janelaIni)
    .lte("data_hora", janelaFim);

  const choque = (existentes ?? []).some((c) => {
    if (input.id && c.id === input.id) return false;
    const cIni = new Date(c.data_hora);
    const cFim = new Date(cIni.getTime() + (c.duracao_minutos || 30) * 60000);
    return inicio < cFim && fim > cIni;
  });
  if (choque && input.status !== "cancelado") {
    return { erro: "Já existe um agendamento neste horário para o profissional." };
  }

  const dados = {
    clinica_id: clinicaId,
    paciente_id: input.paciente_id,
    profissional_id: input.profissional_id,
    convenio_id: input.convenio_id || null,
    data_hora: inicio.toISOString(),
    duracao_minutos: duracao,
    tipo: input.tipo,
    status: input.status,
    valor: input.valor ?? null,
    observacoes: input.observacoes || null,
  };

  let consultaId = input.id;
  if (consultaId) {
    const { error } = await supabase
      .from("consulta")
      .update(dados)
      .eq("id", consultaId)
      .eq("clinica_id", clinicaId);
    if (error) return { erro: "Sem permissão para editar o agendamento." };
  } else {
    const { data, error } = await supabase
      .from("consulta")
      .insert(dados)
      .select("id")
      .single();
    if (error) return { erro: "Sem permissão para criar o agendamento." };
    consultaId = data.id;
  }

  // Serviços da consulta (N:N) — substituição do conjunto
  await supabase
    .from("consulta_servico")
    .delete()
    .eq("consulta_id", consultaId);
  if (input.servico_ids.length > 0) {
    const { error } = await supabase.from("consulta_servico").insert(
      input.servico_ids.map((servico_id) => ({
        clinica_id: clinicaId,
        consulta_id: consultaId!,
        servico_id,
      }))
    );
    if (error) return { erro: "Agendamento salvo, mas erro nos serviços." };
  }

  revalidatePath("/painel/agenda");
  return { erro: null, ok: true };
}

/** Profissional altera o status das PRÓPRIAS consultas (confirmar/atender/
 *  concluir/faltou). A escrita passa pelo RLS: o profissional tem policy de
 *  UPDATE? Não — só leitura. Por isso status é operado por recepção/gestão;
 *  esta action valida o papel de agenda. */
export async function atualizarStatusConsulta(
  consultaId: string,
  status: ConsultaInput["status"]
): Promise<EstadoConsulta> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };
  if (!PAPEIS_AGENDA.includes(sessao.papel ?? "") && !sessao.isAdmin) {
    return { erro: "Sem permissão." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("consulta")
    .update({ status })
    .eq("id", consultaId)
    .eq("clinica_id", sessao.clinicaAtual);
  if (error) return { erro: "Sem permissão para alterar o status." };

  revalidatePath("/painel/agenda");
  return { erro: null, ok: true };
}

export async function excluirConsulta(
  consultaId: string
): Promise<EstadoConsulta> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };

  const supabase = createClient();
  const { error } = await supabase
    .from("consulta")
    .delete()
    .eq("id", consultaId)
    .eq("clinica_id", sessao.clinicaAtual);
  if (error) return { erro: "Sem permissão para excluir." };

  revalidatePath("/painel/agenda");
  return { erro: null, ok: true };
}
