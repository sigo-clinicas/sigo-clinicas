// S4-6 — Rate-limit dos endpoints públicos, backed por Postgres (fixed window
// via RPC consumir_rate_limit, chamada com service_role). Fail-OPEN: se a
// infra do limiter falhar, NUNCA derruba o endpoint (o rate-limit é proteção
// contra abuso, não uma barreira de segurança — essa é o service_role + gate).

import { createAdminClient } from "@/lib/supabase/admin";

/** IP do request atrás do proxy (Vercel/Supabase setam x-forwarded-for). */
export function ipDoRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "sem-ip";
}

/** true = dentro do limite (segue); false = estourou (deve responder 429). */
export async function consumirRateLimit(
  chave: string,
  limite: number,
  janelaSegundos: number
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consumir_rate_limit", {
      p_chave: chave,
      p_limite: limite,
      p_janela_seg: janelaSegundos,
    });
    if (error) return true; // fail-open
    return data !== false;
  } catch {
    return true; // fail-open
  }
}
