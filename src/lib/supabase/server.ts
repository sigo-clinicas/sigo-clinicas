import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/**
 * Client Supabase server-side LIGADO À SESSÃO do usuário (Opção B do
 * CLAUDE.md §2): toda query roda com o JWT do usuário e o RLS aplica papel +
 * clinica_id dos claims. É o client padrão de Server Components, Server
 * Actions e Route Handlers para CRUD autenticado.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado a partir de um Server Component: o refresh do token é
            // feito pelo middleware; ignorar é seguro aqui.
          }
        },
      },
    }
  );
}
