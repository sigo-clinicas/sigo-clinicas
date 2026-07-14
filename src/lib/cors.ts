// S4-6 — CORS restrito por origem para os endpoints públicos (nunca `*`).
// Em produção, setar PUBLIC_ALLOWED_ORIGINS="https://app.sigoclinicas.com,https://sigoclinicas.com".
// Lista vazia = dev: reflete a origem do request (permissivo só local). CORS é
// defesa em profundidade — a barreira real é service_role + validação no servidor.

const ALLOWED = (process.env.PUBLIC_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Headers de CORS para uma origem. Origem não permitida → "null" (bloqueado). */
export function corsHeaders(origin: string | null): Record<string, string> {
  const liberar = origin && (ALLOWED.length === 0 || ALLOWED.includes(origin));
  return {
    "Access-Control-Allow-Origin": liberar ? origin! : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
}
