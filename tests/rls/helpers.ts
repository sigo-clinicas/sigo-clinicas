import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Harness dos testes de policy RLS/RBAC (CLAUDE.md §5 — teste obrigatório).
 * Rodam contra um Supabase local (`supabase start`) com o Custom Access Token
 * Hook habilitado, validando o caminho REAL: login → hook injeta claims →
 * policy lê claims. Sem o ambiente, os testes são pulados (o CI sempre roda).
 */
export const env = {
  url: process.env.SUPABASE_TEST_URL ?? "",
  anonKey: process.env.SUPABASE_TEST_ANON_KEY ?? "",
  serviceRoleKey: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "",
};

export const temAmbiente = Boolean(env.url && env.anonKey && env.serviceRoleKey);

export function clientServiceRole(): SupabaseClient {
  return createClient(env.url, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function clientAnon(): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Cria um usuário confirmado e devolve o id. */
export async function criarUsuario(
  admin: SupabaseClient,
  email: string,
  senha: string
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

/** Loga e devolve um client autenticado (JWT já com os claims do hook). */
export async function clientLogado(
  email: string,
  senha: string
): Promise<SupabaseClient> {
  const client = clientAnon();
  const { error } = await client.auth.signInWithPassword({
    email,
    password: senha,
  });
  if (error) throw error;
  return client;
}
