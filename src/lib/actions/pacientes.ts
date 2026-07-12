"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * S1-7 — Paciente GLOBAL (A1/M3): a pessoa é cadastrada uma vez na
 * plataforma; cada clínica tem um VÍNCULO (paciente_clinica) com dados de
 * convênio próprios. Dedup por CPF/e-mail no cadastro (a busca global usa o
 * admin client apenas para LEITURA de dedup — o paciente pode existir e estar
 * vinculado a outra clínica, invisível ao RLS do usuário atual).
 */

export type PacienteInput = {
  id?: string;
  nome: string;
  cpf?: string | null;
  data_nascimento?: string | null;
  telefone?: string | null;
  email?: string | null;
  logradouro?: string | null;
  sexo?: "masculino" | "feminino" | "outro" | null;
  nome_mae?: string | null;
  contato_emergencia_nome?: string | null;
  contato_emergencia_telefone?: string | null;
  contato_emergencia_parentesco?: string | null;
  observacoes?: string | null;
  ativo: boolean;
  // dados do vínculo com a clínica atual
  convenio_id?: string | null;
  numero_carteirinha?: string | null;
  origem?: string | null;
};

export type EstadoPaciente = {
  erro: string | null;
  ok?: boolean;
  pacienteId?: string;
};

function normalizarCpf(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const limpo = cpf.replace(/\D/g, "");
  return limpo.length > 0 ? limpo : null;
}

export async function salvarPaciente(
  input: PacienteInput
): Promise<EstadoPaciente> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };
  const papeisEscrita = [
    "proprietario",
    "gerente",
    "recepcionista",
    "assistente",
    "profissional",
  ];
  if (!papeisEscrita.includes(sessao.papel ?? "") && !sessao.isAdmin) {
    return { erro: "Sem permissão para cadastrar pacientes." };
  }
  if (!input.nome.trim()) return { erro: "Nome é obrigatório." };

  const supabase = createClient();
  const cpf = normalizarCpf(input.cpf);
  const email = input.email?.trim().toLowerCase() || null;

  // Criar paciente global + vincular à clínica é transacional e cruza a
  // fronteira global↔tenant → RPC (Opção B). A RPC valida o papel do chamador
  // pelos claims, deduplica por CPF/e-mail e devolve o id do paciente.
  const { data: pacienteId, error } = await supabase.rpc(
    "salvar_paciente_clinica",
    {
      p_clinica_id: sessao.clinicaAtual,
      p_paciente_id: input.id,
      p_dados: {
        nome: input.nome.trim(),
        cpf,
        data_nascimento: input.data_nascimento || null,
        telefone: input.telefone || null,
        email,
        logradouro: input.logradouro || null,
        sexo: input.sexo || null,
        nome_mae: input.nome_mae || null,
        contato_emergencia_nome: input.contato_emergencia_nome || null,
        contato_emergencia_telefone: input.contato_emergencia_telefone || null,
        contato_emergencia_parentesco:
          input.contato_emergencia_parentesco || null,
        observacoes: input.observacoes || null,
        ativo: input.ativo,
      },
      p_vinculo: {
        convenio_id: input.convenio_id || null,
        numero_carteirinha: input.numero_carteirinha || null,
        origem: input.origem || null,
      },
    }
  );

  if (error) {
    return {
      erro:
        error.code === "23505"
          ? "Já existe um paciente com este CPF."
          : error.code === "42501"
            ? "Sem permissão para cadastrar pacientes."
            : "Não foi possível salvar o paciente.",
    };
  }

  revalidatePath("/painel/pacientes");
  return { erro: null, ok: true, pacienteId: pacienteId as string };
}

/** Remove o VÍNCULO do paciente com a clínica (não apaga o cadastro global). */
export async function desvincularPaciente(
  pacienteId: string
): Promise<EstadoPaciente> {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { erro: "Sessão inválida." };

  const supabase = createClient();
  const { error } = await supabase
    .from("paciente_clinica")
    .delete()
    .eq("paciente_id", pacienteId)
    .eq("clinica_id", sessao.clinicaAtual);
  if (error) return { erro: "Sem permissão para remover o paciente." };

  revalidatePath("/painel/pacientes");
  return { erro: null, ok: true };
}
