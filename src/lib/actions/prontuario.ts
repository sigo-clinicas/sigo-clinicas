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

/**
 * Gate de consentimento LGPD (S2-5): o fluxo exige TCLE assinado antes de
 * registrar avaliação, e uso_imagem antes de anexar fotos. Consulta a RPC
 * consentimento_vigente (documento assinado e não revogado).
 */
async function temConsentimento(
  supabase: ReturnType<typeof createClient>,
  pacienteId: string,
  clinicaId: string,
  tipo: "tcle" | "uso_imagem"
): Promise<boolean> {
  const { data } = await supabase.rpc("consentimento_vigente", {
    p_paciente_id: pacienteId,
    p_clinica_id: clinicaId,
    p_tipo: tipo,
  });
  return data === true;
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
  const clinicaId = sessao.clinicaAtual!;

  // Gate LGPD: TCLE assinado antes de registrar a avaliação; uso_imagem se anexa fotos.
  if (!input.id && !(await temConsentimento(supabase, input.paciente_id, clinicaId, "tcle"))) {
    return { erro: "É preciso um TCLE (consentimento) assinado do paciente antes de registrar a avaliação." };
  }
  if (input.fotos.length > 0 && !(await temConsentimento(supabase, input.paciente_id, clinicaId, "uso_imagem"))) {
    return { erro: "É preciso o termo de uso de imagem assinado para anexar fotos." };
  }

  const dados = {
    clinica_id: clinicaId,
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

// ============================================================================
// S2-3 — Evolução clínica + insumos (ponte controlada p/ estoque) + galeria
// ============================================================================

export type InsumoEvolucaoInput = {
  id?: string; // presente = já salvo (não reinsere)
  produto_nome: string;
  fabricante?: string | null;
  quantidade?: string | null;
  lote?: string | null;
  validade?: string | null;
  item_estoque_id?: string | null; // vinculado ao estoque → habilita baixa
};

export type EvolucaoInput = {
  id?: string;
  paciente_id: string;
  profissional_id?: string | null;
  consulta_id?: string | null;
  data_hora: string;
  descricao_atendimento?: string | null;
  reacao_paciente?: string | null;
  intercorrencias?: string | null;
  orientacoes_pos?: string | null;
  prescricao?: string | null;
  proxima_sessao_sugerida?: string | null; // 'YYYY-MM-DD' → gera retorno (D5)
  fotos: FotoProntuario[];
  insumos: InsumoEvolucaoInput[];
  baixarInsumos: boolean; // dispara a RPC de baixa (D4)
};

export async function salvarEvolucao(
  input: EvolucaoInput
): Promise<EstadoProntuario & { baixas?: number }> {
  const { sessao, erro } = await exigirClinico();
  if (!sessao) return { erro };
  if (!input.paciente_id) return { erro: "Paciente é obrigatório." };
  const clinicaId = sessao.clinicaAtual!;

  const supabase = createClient();

  // Gate LGPD: uso_imagem assinado antes de anexar fotos à evolução.
  if (input.fotos.length > 0 && !(await temConsentimento(supabase, input.paciente_id, clinicaId, "uso_imagem"))) {
    return { erro: "É preciso o termo de uso de imagem assinado para anexar fotos." };
  }

  // numero_sessao automático só no cadastro novo (conta as evoluções do paciente)
  let numeroSessao: number | null = null;
  if (!input.id) {
    const { count } = await supabase
      .from("evolucao_sessao")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaId)
      .eq("paciente_id", input.paciente_id);
    numeroSessao = (count ?? 0) + 1;
  }

  const dados = {
    clinica_id: clinicaId,
    paciente_id: input.paciente_id,
    profissional_id: input.profissional_id || null,
    consulta_id: input.consulta_id || null,
    data_hora: input.data_hora || new Date().toISOString(),
    descricao_atendimento: input.descricao_atendimento || null,
    reacao_paciente: input.reacao_paciente || null,
    intercorrencias: input.intercorrencias || null,
    orientacoes_pos: input.orientacoes_pos || null,
    prescricao: input.prescricao || null,
    proxima_sessao_sugerida: input.proxima_sessao_sugerida || null,
    fotos: input.fotos as unknown as Json,
    ...(numeroSessao !== null ? { numero_sessao: numeroSessao } : {}),
  };

  const { data: ev, error } = input.id
    ? await supabase
        .from("evolucao_sessao")
        .update(dados)
        .eq("id", input.id)
        .eq("clinica_id", clinicaId)
        .select("id")
        .single()
    : await supabase.from("evolucao_sessao").insert(dados).select("id").single();

  if (error || !ev) {
    return {
      erro:
        error?.code === "23514"
          ? "Este paciente não pertence à clínica."
          : "Sem permissão para salvar a evolução.",
    };
  }
  const evolucaoId = ev.id;

  // Insere apenas insumos NOVOS (sem id); os já salvos não são tocados aqui —
  // remoção é fluxo próprio (removerInsumoEvolucao) para reverter a baixa.
  const novos = input.insumos.filter((i) => !i.id && i.produto_nome.trim());
  if (novos.length > 0) {
    const { error: errIns } = await supabase.from("evolucao_insumo").insert(
      novos.map((i) => ({
        clinica_id: clinicaId,
        evolucao_id: evolucaoId,
        produto_nome: i.produto_nome.trim(),
        fabricante: i.fabricante || null,
        quantidade: i.quantidade || null,
        lote: i.lote || null,
        validade: i.validade || null,
        item_estoque_id: i.item_estoque_id || null,
      }))
    );
    if (errIns) return { erro: "Sem permissão para registrar os insumos." };
  }

  // Baixa de estoque (D4): só os insumos vinculados e ainda não baixados. A RPC
  // é idempotente e valida tenant dos dois lados.
  let baixas: number | undefined;
  if (input.baixarInsumos) {
    const { data, error: errBaixa } = await supabase.rpc("baixar_insumos_evolucao", {
      p_evolucao_id: evolucaoId,
    });
    if (errBaixa) {
      return {
        erro:
          errBaixa.code === "23514"
            ? "Saldo insuficiente (ou item de outra clínica) para baixar os insumos."
            : "Não foi possível baixar os insumos do estoque.",
        ok: true,
        id: evolucaoId,
      };
    }
    baixas = typeof data === "number" ? data : undefined;
  }

  // Próxima sessão sugerida (D5): vira consulta de retorno via RPC (só no cadastro
  // novo; best-effort — não deixa a evolução falhar se não der p/ agendar).
  if (!input.id && input.proxima_sessao_sugerida) {
    await supabase.rpc("criar_consulta_retorno", {
      p_evolucao_id: evolucaoId,
      p_data_hora: `${input.proxima_sessao_sugerida}T09:00:00`,
      p_duracao_minutos: 30,
    });
  }

  revalidatePath(`/painel/prontuarios/${input.paciente_id}`);
  return { erro: null, ok: true, id: evolucaoId, baixas };
}

/** Remove um insumo; se já tinha baixa de estoque, a RPC reverte a movimentação. */
export async function removerInsumoEvolucao(input: {
  insumoId: string;
  pacienteId: string;
}): Promise<EstadoProntuario> {
  const { sessao, erro } = await exigirClinico();
  if (!sessao) return { erro };

  const supabase = createClient();
  const { error } = await supabase.rpc("remover_insumo_evolucao", {
    p_insumo_id: input.insumoId,
  });
  if (error) return { erro: "Não foi possível remover o insumo." };

  revalidatePath(`/painel/prontuarios/${input.pacienteId}`);
  return { erro: null, ok: true };
}

export type GaleriaFotoInput = {
  paciente_id: string;
  path: string;
  categoria: "antes" | "depois" | "evolucao" | "detalhe" | "outro";
  descricao?: string | null;
  data?: string | null;
};

export async function adicionarFotoGaleria(
  input: GaleriaFotoInput
): Promise<EstadoProntuario> {
  const { sessao, erro } = await exigirClinico();
  if (!sessao) return { erro };

  const supabase = createClient();
  // Gate LGPD: uso_imagem assinado antes de subir foto à galeria.
  if (!(await temConsentimento(supabase, input.paciente_id, sessao.clinicaAtual!, "uso_imagem"))) {
    return { erro: "É preciso o termo de uso de imagem assinado para adicionar fotos." };
  }
  const { error } = await supabase.from("galeria_foto").insert({
    clinica_id: sessao.clinicaAtual!,
    paciente_id: input.paciente_id,
    path: input.path,
    categoria: input.categoria,
    origem: "galeria",
    descricao: input.descricao || null,
    data: input.data || new Date().toISOString().slice(0, 10),
  });
  if (error) {
    return {
      erro:
        error.code === "23514"
          ? "Este paciente não pertence à clínica."
          : "Sem permissão para adicionar a foto.",
    };
  }

  revalidatePath(`/painel/prontuarios/${input.paciente_id}`);
  return { erro: null, ok: true };
}

/** Remove foto avulsa da galeria (só gestão, pela policy de delete). */
export async function removerFotoGaleria(input: {
  fotoId: string;
  pacienteId: string;
}): Promise<EstadoProntuario> {
  const { sessao, erro } = await exigirClinico();
  if (!sessao) return { erro };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("galeria_foto")
    .delete()
    .eq("id", input.fotoId)
    .select("id");
  if (error) return { erro: "Sem permissão para remover a foto." };
  if (!data?.length) return { erro: "Só a gestão remove fotos da galeria." };

  revalidatePath(`/painel/prontuarios/${input.pacienteId}`);
  return { erro: null, ok: true };
}
