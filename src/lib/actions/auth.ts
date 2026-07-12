"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export type EstadoAuth = { erro: string | null; ok?: boolean };

export async function login(
  _estadoAnterior: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    // Mensagem genérica: não revelar se o e-mail existe
    return { erro: "E-mail ou senha inválidos." };
  }

  redirect("/painel");
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function recuperarSenha(
  _estadoAnterior: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { erro: "Informe o e-mail cadastrado." };
  }

  const origin = headers().get("origin") ?? "http://localhost:3000";
  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/redefinir-senha`,
  });

  // Resposta idêntica com ou sem cadastro (não vazar existência do e-mail)
  return { erro: null, ok: true };
}

export async function redefinirSenha(
  _estadoAnterior: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (senha.length < 8) {
    return { erro: "A senha precisa de pelo menos 8 caracteres." };
  }
  if (senha !== confirmacao) {
    return { erro: "As senhas não conferem." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    return {
      erro: "Link de redefinição inválido ou expirado. Solicite um novo.",
    };
  }

  redirect("/login?senha_redefinida=1");
}
