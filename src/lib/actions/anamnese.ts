"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

/**
 * S2-4 — Anamnese configurável + geração de link público.
 * CRUD de formulario_anamnese e geração da resposta_anamnese (com token) rodam
 * pelo client de SESSÃO (RLS aplica papel + clinica_id). O preenchimento público
 * NÃO passa por aqui — vai pela Edge Function anamnese-publica (service_role
 * escopado por token). O submit público é encaminhado à Edge por uma action
 * server-side para manter a chave fora do browser.
 */

export type TipoPergunta =
  | "texto"
  | "texto_longo"
  | "sim_nao"
  | "multipla_escolha"
  | "numero";

export type Pergunta = {
  id: string;
  texto: string;
  tipo: TipoPergunta;
  opcoes: string[];
  obrigatoria: boolean;
};

export type FormularioInput = {
  id?: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  perguntas: Pergunta[];
};

export type EstadoAnamnese = { erro: string | null; ok?: boolean; token?: string };

const PAPEIS_CONFIG = ["proprietario", "gerente", "recepcionista", "assistente"];
const PAPEIS_LINK = [...PAPEIS_CONFIG, "profissional"];

async function exigir(papeis: string[]) {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { sessao: null, erro: "Sessão inválida." } as const;
  if (!papeis.includes(sessao.papel ?? "") && !sessao.isAdmin) {
    return { sessao: null, erro: "Sem permissão." } as const;
  }
  return { sessao, erro: null } as const;
}

/** Valida o shape das perguntas no servidor (o jsonb não é validado pelo PG). */
function validarPerguntas(perguntas: Pergunta[]): string | null {
  for (const p of perguntas) {
    if (!p.texto.trim()) return "Toda pergunta precisa de um enunciado.";
    if (p.tipo === "multipla_escolha" && p.opcoes.filter((o) => o.trim()).length < 2) {
      return "Perguntas de múltipla escolha precisam de ao menos 2 opções.";
    }
  }
  return null;
}

export async function salvarFormulario(
  input: FormularioInput
): Promise<EstadoAnamnese> {
  const { sessao, erro } = await exigir(PAPEIS_CONFIG);
  if (!sessao) return { erro };
  if (!input.nome.trim()) return { erro: "O nome do formulário é obrigatório." };
  const erroPerguntas = validarPerguntas(input.perguntas);
  if (erroPerguntas) return { erro: erroPerguntas };

  const supabase = createClient();
  const dados = {
    clinica_id: sessao.clinicaAtual!,
    nome: input.nome.trim(),
    descricao: input.descricao || null,
    ativo: input.ativo,
    perguntas: input.perguntas as unknown as Json,
  };

  const { error } = input.id
    ? await supabase
        .from("formulario_anamnese")
        .update(dados)
        .eq("id", input.id)
        .eq("clinica_id", sessao.clinicaAtual!)
    : await supabase.from("formulario_anamnese").insert(dados);

  if (error) return { erro: "Sem permissão para salvar o formulário." };
  revalidatePath("/painel/anamnese");
  return { erro: null, ok: true };
}

export async function alternarAtivoFormulario(
  id: string,
  ativo: boolean
): Promise<EstadoAnamnese> {
  const { sessao, erro } = await exigir(PAPEIS_CONFIG);
  if (!sessao) return { erro };

  const supabase = createClient();
  const { error } = await supabase
    .from("formulario_anamnese")
    .update({ ativo })
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Sem permissão." };
  revalidatePath("/painel/anamnese");
  return { erro: null, ok: true };
}

export async function excluirFormulario(id: string): Promise<EstadoAnamnese> {
  const { sessao, erro } = await exigir(PAPEIS_CONFIG);
  if (!sessao) return { erro };

  const supabase = createClient();
  const { error } = await supabase
    .from("formulario_anamnese")
    .delete()
    .eq("id", id)
    .eq("clinica_id", sessao.clinicaAtual!);
  if (error) return { erro: "Sem permissão." };
  revalidatePath("/painel/anamnese");
  return { erro: null, ok: true };
}

/**
 * Gera a resposta_anamnese pendente (o token vem do banco: default
 * gen_random_uuid()) e devolve o token para montar o link público. expira_em =
 * now() + clinica.validade_anamnese_dias (calculado no servidor).
 */
export async function gerarLinkAnamnese(input: {
  paciente_id: string;
  formulario_id: string;
}): Promise<EstadoAnamnese> {
  const { sessao, erro } = await exigir(PAPEIS_LINK);
  if (!sessao) return { erro };

  const supabase = createClient();
  const { data: clinica } = await supabase
    .from("clinica")
    .select("validade_anamnese_dias")
    .eq("id", sessao.clinicaAtual!)
    .single();
  const dias = clinica?.validade_anamnese_dias ?? 7;
  const expira = new Date(Date.now() + dias * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("resposta_anamnese")
    .insert({
      clinica_id: sessao.clinicaAtual!,
      paciente_id: input.paciente_id,
      formulario_id: input.formulario_id,
      expira_em: expira,
    })
    .select("token")
    .single();

  if (error || !data) {
    return {
      erro:
        error?.code === "23514"
          ? "Este paciente não pertence à clínica."
          : "Não foi possível gerar o link.",
    };
  }
  revalidatePath(`/painel/prontuarios/${input.paciente_id}`);
  return { erro: null, ok: true, token: data.token };
}

/**
 * Encaminha o SUBMIT público à Edge Function (server-side, chave fora do
 * browser). Usada pela página pública /anamnese/[token] (sem sessão).
 */
export async function enviarRespostaAnamnese(input: {
  token: string;
  respostas: { pergunta_id: string; pergunta_texto: string; resposta: string }[];
}): Promise<{ ok: boolean; erro: string | null }> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/anamnese-publica`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "submit", token: input.token, respostas: input.respostas }),
    });
    if (r.ok) return { ok: true, erro: null };
    const j = await r.json().catch(() => ({}));
    const mapa: Record<string, string> = {
      already_filled: "Esta ficha já foi preenchida.",
      expired: "Este link expirou.",
      not_found: "Ficha não encontrada.",
      missing_required: "Preencha os campos obrigatórios.",
    };
    return { ok: false, erro: mapa[(j as { error?: string }).error ?? ""] ?? "Não foi possível enviar." };
  } catch {
    return { ok: false, erro: "Falha de conexão ao enviar." };
  }
}
