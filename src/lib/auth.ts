import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Sessão + claims de RBAC do JWT (injetados pelo custom_access_token_hook,
 * migration 0300). É a ÚNICA porta de entrada de papel/clínica no app —
 * toda página/Server Action do painel consome daqui. Os claims orientam
 * UI e navegação; a segurança real é o RLS aplicado pelo Postgres.
 */

export type Papel =
  | "proprietario"
  | "gerente"
  | "recepcionista"
  | "assistente"
  | "profissional";

export type Sessao = {
  user: User;
  /** { clinica_id: papel } — todas as clínicas do usuário (claim `clinicas`) */
  clinicas: Record<string, Papel>;
  /** Clínica ativa (cookie `clinica_atual`, validado contra os claims) */
  clinicaAtual: string | null;
  /** Papel do usuário na clínica ativa */
  papel: Papel | null;
  isAdmin: boolean;
  pacienteId: string | null;
};

const COOKIE_CLINICA = "clinica_atual";

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

export const getSessaoComClaims = cache(async (): Promise<Sessao | null> => {
  const supabase = createClient();

  // getUser() valida o token junto ao Auth server (não confiar só no cookie)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const claims = decodeJwtPayload(session.access_token);
  const clinicas = (claims.clinicas ?? {}) as Record<string, Papel>;
  const ids = Object.keys(clinicas);

  const cookieClinica = cookies().get(COOKIE_CLINICA)?.value ?? null;
  const clinicaAtual =
    cookieClinica && clinicas[cookieClinica] ? cookieClinica : ids[0] ?? null;

  return {
    user,
    clinicas,
    clinicaAtual,
    papel: clinicaAtual ? clinicas[clinicaAtual] : null,
    isAdmin: claims.admin_plataforma === true,
    pacienteId: (claims.paciente_id as string | undefined) ?? null,
  };
});

export { COOKIE_CLINICA };
