"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import type { TipoClinica } from "@/lib/terminologia";

/**
 * Configurações da clínica (S1-3). Matriz do legado: só o PROPRIETÁRIO
 * (e admin de plataforma) edita o cadastro da clínica — gerente não
 * (AuthorizationListener não dava Clinica\Clinicas ao gerente). O RLS
 * (policy clinica_update_proprietario) garante isso no banco.
 */

export type EstadoClinica = { erro: string | null; ok?: boolean };

async function exigirProprietario() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { sessao: null, erro: "Sessão inválida." } as const;
  if (sessao.papel !== "proprietario" && !sessao.isAdmin) {
    return {
      sessao: null,
      erro: "Apenas o proprietário altera as configurações da clínica.",
    } as const;
  }
  return { sessao, erro: null } as const;
}

export async function atualizarDadosClinica(
  _estado: EstadoClinica,
  formData: FormData
): Promise<EstadoClinica> {
  const { sessao, erro } = await exigirProprietario();
  if (!sessao) return { erro };

  const tipo = String(formData.get("tipo") ?? "medica") as TipoClinica;
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "O nome da clínica é obrigatório." };

  const supabase = createClient();
  const { error } = await supabase
    .from("clinica")
    .update({
      tipo,
      nome,
      cidade: String(formData.get("cidade") ?? "").trim() || null,
      cnpj: String(formData.get("cnpj") ?? "").trim() || null,
      telefone: String(formData.get("telefone") ?? "").trim() || null,
      logradouro: String(formData.get("endereco") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
    })
    .eq("id", sessao.clinicaAtual!);

  if (error) return { erro: "Sem permissão para alterar a clínica." };

  // Tema/terminologia mudam com o tipo → revalida o layout inteiro do painel
  revalidatePath("/painel", "layout");
  return { erro: null, ok: true };
}

/** Merge raso em clinica.config (base_comissao, lembretes, canais, origens). */
export async function atualizarConfigClinica(
  patch: Record<string, unknown>
): Promise<EstadoClinica> {
  const { sessao, erro } = await exigirProprietario();
  if (!sessao) return { erro };

  const supabase = createClient();
  const { data: atual, error: erroLeitura } = await supabase
    .from("clinica")
    .select("config")
    .eq("id", sessao.clinicaAtual!)
    .single();
  if (erroLeitura) return { erro: "Não foi possível carregar a configuração." };

  const config = {
    ...((atual?.config as Record<string, Json> | null) ?? {}),
    ...patch,
  } as Json;
  const { error } = await supabase
    .from("clinica")
    .update({ config })
    .eq("id", sessao.clinicaAtual!);

  if (error) return { erro: "Sem permissão para alterar a configuração." };

  revalidatePath("/painel/configuracoes");
  return { erro: null, ok: true };
}
