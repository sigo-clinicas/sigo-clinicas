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

  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;

  const supabase = createClient();
  const { error } = await supabase
    .from("clinica")
    .update({
      tipo,
      nome,
      // S4-1: marca + endereço completo (colunas já existentes no schema)
      razao_social: str("razao_social"),
      cnpj: str("cnpj"),
      telefone: str("telefone"),
      email: str("email"),
      cep: str("cep"),
      uf: str("uf")?.toUpperCase().slice(0, 2) ?? null,
      cidade: str("cidade"),
      bairro: str("bairro"),
      logradouro: str("endereco"),
      numero: str("numero"),
      complemento: str("complemento"),
      sobre: str("sobre"),
      slug: str("slug"),
      exibir_marketplace: formData.get("exibir_marketplace") === "1",
    })
    .eq("id", sessao.clinicaAtual!);

  if (error) {
    return {
      erro:
        error.code === "23505"
          ? "Esse endereço público (slug) já está em uso."
          : "Sem permissão para alterar a clínica.",
    };
  }

  // Tema/terminologia/marca mudam → revalida o layout inteiro do painel
  revalidatePath("/painel", "layout");
  return { erro: null, ok: true };
}

/**
 * S4-1 — Upload do logo da clínica (bucket público `logos`, path por clínica).
 * Só proprietário/admin. A storage policy `logos_insert` já escopa por clínica.
 */
export async function uploadLogoClinica(formData: FormData): Promise<EstadoClinica> {
  const { sessao, erro } = await exigirProprietario();
  if (!sessao) return { erro };

  const arquivo = formData.get("logo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione um arquivo de imagem." };
  }
  if (!arquivo.type.startsWith("image/")) {
    return { erro: "O logo deve ser uma imagem." };
  }
  if (arquivo.size > 2 * 1024 * 1024) {
    return { erro: "Imagem muito grande (máx. 2MB)." };
  }

  const clinicaId = sessao.clinicaAtual!;
  const ext = (arquivo.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${clinicaId}/logo.${ext || "png"}`;

  const supabase = createClient();
  const { error: upErro } = await supabase.storage
    .from("logos")
    .upload(path, arquivo, { upsert: true, contentType: arquivo.type });
  if (upErro) return { erro: "Não foi possível enviar o logo." };

  const { error } = await supabase
    .from("clinica")
    .update({ logo_path: path })
    .eq("id", clinicaId);
  if (error) return { erro: "Logo enviado, mas não foi possível salvar." };

  revalidatePath("/painel", "layout");
  revalidatePath("/painel/configuracoes");
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
