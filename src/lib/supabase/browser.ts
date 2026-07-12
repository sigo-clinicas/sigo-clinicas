"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/**
 * Client Supabase no BROWSER, ligado à sessão do usuário. Usado só para
 * uploads ao Storage (fotos de prontuário, assinaturas) — a storage policy
 * escopada por clinica_id (migration 1100) aplica com o JWT do usuário.
 * NUNCA usa service_role. Leitura de objetos privados é via signed URL
 * gerada no servidor (src/lib/storage.ts).
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
