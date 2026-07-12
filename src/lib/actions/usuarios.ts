"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getSessaoComClaims, COOKIE_CLINICA, type Papel } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Gestão de usuários da clínica (S1-2). Defesa em profundidade:
 * a checagem de papel aqui é a primeira linha; o RLS de clinica_usuario
 * (incl. anti-escalação: gerente não concede 'proprietario') é a garantia
 * final no banco. service_role é usado APENAS para as operações do Auth
 * (convite/revogação de sessão), nunca para contornar RLS de dados.
 */

export type EstadoUsuarios = { erro: string | null; ok?: boolean };

const PAPEIS_GESTAO: Papel[] = ["proprietario", "gerente"];

async function exigirGestao() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) {
    return { sessao: null, erro: "Sessão inválida." } as const;
  }
  if (!PAPEIS_GESTAO.includes(sessao.papel) && !sessao.isAdmin) {
    return { sessao: null, erro: "Sem permissão para gerenciar usuários." } as const;
  }
  return { sessao, erro: null } as const;
}

export async function convidarUsuario(
  _estado: EstadoUsuarios,
  formData: FormData
): Promise<EstadoUsuarios> {
  const { sessao, erro } = await exigirGestao();
  if (!sessao) return { erro };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const papel = String(formData.get("papel") ?? "") as Papel;

  if (!email) return { erro: "E-mail é obrigatório." };
  if (papel === "proprietario" && sessao.papel !== "proprietario" && !sessao.isAdmin) {
    return { erro: "Apenas o proprietário concede o papel de proprietário." };
  }

  const supabase = createClient();
  const admin = createAdminClient();
  const clinicaId = sessao.clinicaAtual!;

  // Limite do plano (papel → limites jsonb do plano_assinatura)
  const { data: assinatura } = await supabase
    .from("assinatura_clinica")
    .select("plano:plano_assinatura(nome,limites)")
    .eq("clinica_id", clinicaId)
    .eq("status", "ativa")
    .maybeSingle();

  if (assinatura?.plano) {
    const limites = (assinatura.plano.limites ?? {}) as Record<string, number>;
    const limite = limites[papel];
    if (limite !== undefined) {
      const { count } = await supabase
        .from("clinica_usuario")
        .select("id", { count: "exact", head: true })
        .eq("clinica_id", clinicaId)
        .eq("papel", papel)
        .eq("ativo", true);
      if ((count ?? 0) >= limite) {
        return {
          erro: `Limite de ${limite} usuário(s) "${papel}" atingido no plano ${assinatura.plano.nome}.`,
        };
      }
    }
  }

  // Usuário já existe no Auth? Convida só se não existir.
  let userId: string;
  const { data: convite, error: erroConvite } =
    await admin.auth.admin.inviteUserByEmail(email);
  if (erroConvite) {
    const { data: lista } = await admin.auth.admin.listUsers();
    const existente = lista?.users.find(
      (u) => u.email?.toLowerCase() === email
    );
    if (!existente) return { erro: "Não foi possível convidar este e-mail." };
    userId = existente.id;
  } else {
    userId = convite.user.id;
  }

  // Vínculo criado com o client DA SESSÃO: o RLS valida papel do ator e
  // bloqueia escalação — nunca via service_role.
  const { error: erroVinculo } = await supabase.from("clinica_usuario").insert({
    clinica_id: clinicaId,
    user_id: userId,
    papel,
  });
  if (erroVinculo) {
    return {
      erro:
        erroVinculo.code === "23505"
          ? "Este usuário já pertence à clínica."
          : "Sem permissão para criar este vínculo.",
    };
  }

  revalidatePath("/painel/usuarios");
  return { erro: null, ok: true };
}

export async function alterarPapel(
  _estado: EstadoUsuarios,
  formData: FormData
): Promise<EstadoUsuarios> {
  const { sessao, erro } = await exigirGestao();
  if (!sessao) return { erro };

  const vinculoId = String(formData.get("vinculo_id") ?? "");
  const papel = String(formData.get("papel") ?? "") as Papel;
  const userId = String(formData.get("user_id") ?? "");

  if (!vinculoId || !papel || !userId) return { erro: "Dados incompletos." };
  if (userId === sessao.user.id) {
    return { erro: "Você não pode alterar o próprio papel." };
  }

  const supabase = createClient();
  const { error: erroUpdate } = await supabase
    .from("clinica_usuario")
    .update({ papel })
    .eq("id", vinculoId)
    .eq("clinica_id", sessao.clinicaAtual!);
  if (erroUpdate) return { erro: "Sem permissão para alterar este papel." };

  // Dívida conhecida (aceita): claims valem até o refresh do token. Aqui
  // forçamos signOut global para o novo papel valer no próximo login.
  const admin = createAdminClient();
  await admin.auth.admin.signOut(userId, "global").catch(() => {});

  revalidatePath("/painel/usuarios");
  return { erro: null, ok: true };
}

export async function removerUsuario(
  _estado: EstadoUsuarios,
  formData: FormData
): Promise<EstadoUsuarios> {
  const { sessao, erro } = await exigirGestao();
  if (!sessao) return { erro };

  const vinculoId = String(formData.get("vinculo_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!vinculoId || !userId) return { erro: "Dados incompletos." };
  if (userId === sessao.user.id) {
    return { erro: "Você não pode remover o próprio acesso." };
  }

  const supabase = createClient();
  const { error: erroDelete } = await supabase
    .from("clinica_usuario")
    .delete()
    .eq("id", vinculoId)
    .eq("clinica_id", sessao.clinicaAtual!);
  if (erroDelete) return { erro: "Sem permissão para remover este usuário." };

  const admin = createAdminClient();
  await admin.auth.admin.signOut(userId, "global").catch(() => {});

  revalidatePath("/painel/usuarios");
  return { erro: null, ok: true };
}

/** Troca a clínica ativa (multi-clínica). Valida contra os claims do JWT. */
export async function definirClinicaAtual(formData: FormData): Promise<void> {
  const clinicaId = String(formData.get("clinica_id") ?? "");
  const sessao = await getSessaoComClaims();
  if (!sessao || !sessao.clinicas[clinicaId]) return;

  cookies().set(COOKIE_CLINICA, clinicaId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  revalidatePath("/painel");
}
