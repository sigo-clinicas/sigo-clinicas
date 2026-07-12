"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

/**
 * S2-2 — Prontuário base: avaliação clínica + documentos/consentimento.
 * Escrita: papéis clínicos (proprietário/gerente/recepcionista/assistente/
 * profissional); DELETE de registro clínico é barrado (retention-lock, S2-0).
 * clinica_id vem SEMPRE dos claims (nunca do cliente). O trigger
 * garantir_paciente_da_clinica (S2-0) recusa ancorar paciente de outra clínica.
 */

const PAPEIS_CLINICOS = [
  "proprietario",
  "gerente",
  "recepcionista",
  "assistente",
  "profissional",
];

async function exigirClinico() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { sessao: null, erro: "Sessão inválida." } as const;
  if (!PAPEIS_CLINICOS.includes(sessao.papel ?? "") && !sessao.isAdmin) {
    return { sessao: null, erro: "Sem permissão para editar o prontuário." } as const;
  }
  return { sessao, erro: null } as const;
}

/** IP real do request (server-side) para o registro de assinatura (inet). */
function ipDoRequest(): string | null {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
  // inet rejeita hostname/vazio; só devolve se parecer IP
  if (ip && /^[0-9a-fA-F:.]+$/.test(ip)) return ip;
  return null;
}

export type EstadoProntuario = { erro: string | null; ok?: boolean; id?: string };

export type FotoProntuario = {
  path: string;
  descricao?: string;
  data?: string;
  categoria?: string;
};

export type AvaliacaoInput = {
  id?: string;
  paciente_id: string;
  profissional_id?: string | null;
  data: string;
  queixa_principal?: string | null;
  historia_doenca_atual?: string | null;
  historico_familiar?: string | null;
  revisao_sistemas?: string | null;
  pressao_arterial?: string | null;
  frequencia_cardiaca?: string | null;
  peso?: number | null;
  altura?: number | null;
  exame_especifico?: string | null;
  resultados_exames?: string | null;
  hipotese_diagnostica?: string | null;
  plano_terapeutico?: string | null;
  fotos: FotoProntuario[];
};

export async function salvarAvaliacao(
  input: AvaliacaoInput
): Promise<EstadoProntuario> {
  const { sessao, erro } = await exigirClinico();
  if (!sessao) return { erro };
  if (!input.paciente_id) return { erro: "Paciente é obrigatório." };

  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual!,
    paciente_id: input.paciente_id,
    profissional_id: input.profissional_id || null,
    data: input.data || new Date().toISOString().slice(0, 10),
    queixa_principal: input.queixa_principal || null,
    historia_doenca_atual: input.historia_doenca_atual || null,
    historico_familiar: input.historico_familiar || null,
    revisao_sistemas: input.revisao_sistemas || null,
    pressao_arterial: input.pressao_arterial || null,
    frequencia_cardiaca: input.frequencia_cardiaca || null,
    peso: input.peso ?? null,
    altura: input.altura ?? null,
    exame_especifico: input.exame_especifico || null,
    resultados_exames: input.resultados_exames || null,
    hipotese_diagnostica: input.hipotese_diagnostica || null,
    plano_terapeutico: input.plano_terapeutico || null,
    fotos: input.fotos as unknown as Json,
  };

  const { error } = input.id
    ? await supabase
        .from("avaliacao_clinica")
        .update(dados)
        .eq("id", input.id)
        .eq("clinica_id", sessao.clinicaAtual!)
    : await supabase.from("avaliacao_clinica").insert(dados);

  if (error) {
    return {
      erro:
        error.code === "23514"
          ? "Este paciente não pertence à clínica."
          : "Sem permissão para salvar a avaliação.",
    };
  }

  revalidatePath(`/painel/prontuarios/${input.paciente_id}`);
  return { erro: null, ok: true };
}

export type DocumentoInput = {
  id?: string;
  paciente_id: string;
  tipo: "tcle" | "uso_imagem" | "atestado" | "solicitacao" | "declaracao" | "outro";
  titulo: string;
  conteudo?: string | null;
  observacoes?: string | null;
  arquivo_path?: string | null;
};

export async function salvarDocumento(
  input: DocumentoInput
): Promise<EstadoProntuario> {
  const { sessao, erro } = await exigirClinico();
  if (!sessao) return { erro };
  if (!input.titulo.trim()) return { erro: "Título é obrigatório." };

  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual!,
    paciente_id: input.paciente_id,
    tipo: input.tipo,
    titulo: input.titulo.trim(),
    conteudo: input.conteudo || null,
    observacoes: input.observacoes || null,
    arquivo_path: input.arquivo_path || null,
    // arquivo externo entra já assinado (escaneado); demais nascem pendente
    status: input.arquivo_path ? ("assinado" as const) : ("pendente" as const),
  };

  const { data, error } = input.id
    ? await supabase
        .from("documento_consentimento")
        .update(dados)
        .eq("id", input.id)
        .eq("clinica_id", sessao.clinicaAtual!)
        .select("id")
        .single()
    : await supabase
        .from("documento_consentimento")
        .insert(dados)
        .select("id")
        .single();

  if (error) {
    return {
      erro:
        error.code === "23514"
          ? "Este paciente não pertence à clínica."
          : "Sem permissão para salvar o documento.",
    };
  }

  revalidatePath(`/painel/prontuarios/${input.paciente_id}`);
  return { erro: null, ok: true, id: data.id };
}

/** Finaliza a assinatura in-loco: grava status + path da assinatura + IP real
 *  (capturado no servidor, não no browser como fazia o Base44). */
export async function assinarDocumento(input: {
  documentoId: string;
  pacienteId: string;
  assinaturaPath: string;
}): Promise<EstadoProntuario> {
  const { sessao, erro } = await exigirClinico();
  if (!sessao) return { erro };

  const supabase = createClient();
  const { error } = await supabase
    .from("documento_consentimento")
    .update({
      status: "assinado",
      assinatura_path: input.assinaturaPath,
      data_assinatura: new Date().toISOString(),
      ip_assinatura: ipDoRequest(),
    })
    .eq("id", input.documentoId)
    .eq("clinica_id", sessao.clinicaAtual!);

  if (error) return { erro: "Sem permissão para assinar o documento." };

  revalidatePath(`/painel/prontuarios/${input.pacienteId}`);
  return { erro: null, ok: true };
}
