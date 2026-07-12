import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Client com SERVICE_ROLE — ignora RLS. Uso EXCLUSIVO no servidor, e apenas
 * nas operações privilegiadas/transacionais da Opção B (CLAUDE.md §2):
 * RPCs do funil financeiro, ações admin cross-tenant, fluxos públicos com
 * validação própria (ex.: anamnese por token, via Edge Function).
 *
 * O import de "server-only" faz o build FALHAR se este módulo vazar para o
 * bundle do browser. Nunca relaxar isso.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_URL ausentes no ambiente do servidor."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
