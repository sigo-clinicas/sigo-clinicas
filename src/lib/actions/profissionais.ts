"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * S1-5 — Profissionais. Escrita de cadastro: proprietário/gerente (RLS
 * padrão); o próprio profissional edita seus dados e intervalos (policies
 * profissional_update_proprio / intervalo_profissional_proprio).
 * As trocas N:N são substituição de conjunto (delete+insert) — simples e
 * suficiente para cadastros; fluxos transacionais de negócio usam RPC.
 */

export type IntervaloInput = {
  tipo: "fixo" | "pontual";
  motivo: string;
  dia_semana?: number | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  data_hora_inicio?: string | null;
  data_hora_fim?: string | null;
};

export type ProfissionalInput = {
  id?: string;
  nome: string;
  numero_registro?: string | null;
  telefone?: string | null;
  email?: string | null;
  cor?: string | null;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  dias_atendimento: number[];
  ativo: boolean;
  especialidade_ids: string[];
  convenio_ids: string[];
  servicos_comissao: {
    servico_id: string;
    tipo_comissao: "percentual" | "valor_fixo";
    valor_comissao: number;
  }[];
  intervalos: IntervaloInput[];
};

export type EstadoProfissional = {
  erro: string | null;
  ok?: boolean;
  id?: string;
};

export async function salvarProfissional(
  input: ProfissionalInput
): Promise<EstadoProfissional> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };
  if (!input.nome.trim()) return { erro: "Nome é obrigatório." };

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const dados = {
    clinica_id: clinicaId,
    nome: input.nome.trim(),
    numero_registro: input.numero_registro || null,
    telefone: input.telefone || null,
    email: input.email || null,
    cor: input.cor || null,
    horario_inicio: input.horario_inicio || null,
    horario_fim: input.horario_fim || null,
    dias_atendimento: input.dias_atendimento,
    ativo: input.ativo,
  };

  let profissionalId = input.id;
  if (profissionalId) {
    const { error } = await supabase
      .from("profissional")
      .update(dados)
      .eq("id", profissionalId)
      .eq("clinica_id", clinicaId);
    if (error) return { erro: "Sem permissão para editar este profissional." };
  } else {
    const { data, error } = await supabase
      .from("profissional")
      .insert(dados)
      .select("id")
      .single();
    if (error) return { erro: "Sem permissão para criar profissional." };
    profissionalId = data.id;
  }

  // Substituição dos conjuntos N:N (RLS valida cada operação)
  const trocas: { erro: string }[] = [];

  await supabase
    .from("profissional_especialidade")
    .delete()
    .eq("profissional_id", profissionalId);
  if (input.especialidade_ids.length > 0) {
    const { error } = await supabase.from("profissional_especialidade").insert(
      input.especialidade_ids.map((especialidade_id) => ({
        clinica_id: clinicaId,
        profissional_id: profissionalId!,
        especialidade_id,
      }))
    );
    if (error) trocas.push({ erro: "especialidades" });
  }

  await supabase
    .from("profissional_convenio")
    .delete()
    .eq("profissional_id", profissionalId);
  if (input.convenio_ids.length > 0) {
    const { error } = await supabase.from("profissional_convenio").insert(
      input.convenio_ids.map((convenio_id) => ({
        clinica_id: clinicaId,
        profissional_id: profissionalId!,
        convenio_id,
      }))
    );
    if (error) trocas.push({ erro: "convênios" });
  }

  await supabase
    .from("profissional_servico")
    .delete()
    .eq("profissional_id", profissionalId);
  if (input.servicos_comissao.length > 0) {
    const { error } = await supabase.from("profissional_servico").insert(
      input.servicos_comissao.map((sc) => ({
        clinica_id: clinicaId,
        profissional_id: profissionalId!,
        servico_id: sc.servico_id,
        tipo_comissao: sc.tipo_comissao,
        valor_comissao: sc.valor_comissao,
      }))
    );
    if (error) trocas.push({ erro: "serviços/comissões" });
  }

  await supabase
    .from("profissional_intervalo")
    .delete()
    .eq("profissional_id", profissionalId);
  if (input.intervalos.length > 0) {
    const { error } = await supabase.from("profissional_intervalo").insert(
      input.intervalos.map((iv) => ({
        clinica_id: clinicaId,
        profissional_id: profissionalId!,
        tipo: iv.tipo,
        motivo: iv.motivo || "Almoço",
        dia_semana: iv.tipo === "fixo" ? iv.dia_semana : null,
        hora_inicio: iv.tipo === "fixo" ? iv.hora_inicio : null,
        hora_fim: iv.tipo === "fixo" ? iv.hora_fim : null,
        data_hora_inicio: iv.tipo === "pontual" ? iv.data_hora_inicio : null,
        data_hora_fim: iv.tipo === "pontual" ? iv.data_hora_fim : null,
      }))
    );
    if (error) trocas.push({ erro: "bloqueios de agenda" });
  }

  revalidatePath("/painel/profissionais");
  if (trocas.length > 0) {
    return {
      erro: `Dados salvos, mas sem permissão para alterar: ${trocas
        .map((t) => t.erro)
        .join(", ")}.`,
      id: profissionalId,
    };
  }
  return { erro: null, ok: true, id: profissionalId };
}

export async function excluirProfissional(
  id: string
): Promise<EstadoProfissional> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };

  const supabase = createClient();
  const { error } = await supabase
    .from("profissional")
    .delete()
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual);
  if (error) return { erro: "Sem permissão para excluir." };

  revalidatePath("/painel/profissionais");
  return { erro: null, ok: true };
}
