// Edge Function pública de anamnese — porta de base44/functions/anamnesePublica
// (A8: "reaproveitável quase intacta como Edge Function do Supabase"). Preenchida
// por TOKEN, sem login. Usa service_role (injetado pelo runtime, nunca no client)
// escopado SEMPRE por .eq('token', ...). Fecha os furos do original Base44:
//  - valida que o token é UUID ANTES de qualquer query (não-uuid → 400);
//  - .eq('token').maybeSingle() em vez de .filter() que devolvia lista;
//  - expiração (expira_em < now) → 410;
//  - submit é UPDATE ... .eq('token').eq('status','pendente') → o 2º submit
//    concorrente afeta 0 linhas (fecha o TOCTOU do duplo-submit do Base44, que
//    lia e atualizava por id);
//  - revalida perguntas obrigatórias NO SERVIDOR;
//  - CORS restrito, só POST; NUNCA vaza mensagem de erro interna (500 genérico).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Origens liberadas para CORS (browser). Em produção, setar
// ANAMNESE_ALLOWED_ORIGINS="https://app.sigoclinicas.com". Vazio = dev: reflete a
// origem do request (permissivo local). CORS é defesa em profundidade — a barreira
// real é o token + service_role escopado.
const ALLOWED = (Deno.env.get("ANAMNESE_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function cors(origin: string | null): Record<string, string> {
  const liberar = origin && (ALLOWED.length === 0 || ALLOWED.includes(origin));
  return {
    "Access-Control-Allow-Origin": liberar ? origin! : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

type Pergunta = { id: string; texto: string; tipo: string; obrigatoria?: boolean };
type Resposta = { pergunta_id: string; pergunta_texto?: string; resposta?: string };

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const h = cors(origin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, h);

  let body: { action?: string; token?: unknown; respostas?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400, h);
  }
  const { action, token, respostas } = body ?? {};

  // Token tem de ser UUID — barra ANTES de tocar o banco (não-uuid → 400).
  if (typeof token !== "string" || !UUID_RE.test(token)) {
    return json({ error: "invalid_token" }, 400, h);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // S4-6 — rate-limit por IP (abuso/força-bruta de token): 30 req/min.
    // Fail-open: erro do limiter nunca derruba o fluxo público.
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sem-ip";
    const { data: permitido, error: rlErro } = await supabase.rpc("consumir_rate_limit", {
      p_chave: `anamnese:${ip}`,
      p_limite: 30,
      p_janela_seg: 60,
    });
    if (!rlErro && permitido === false) {
      return json({ error: "rate_limited" }, 429, h);
    }

    if (action === "get") {
      const { data: r } = await supabase
        .from("resposta_anamnese")
        .select(
          "status, expira_em, respostas, formulario:formulario_id(nome,descricao,perguntas), paciente:paciente_id(nome)"
        )
        .eq("token", token)
        .maybeSingle();

      if (!r) return json({ error: "not_found" }, 404, h);
      if (r.expira_em && new Date(r.expira_em).getTime() < Date.now()) {
        return json({ error: "expired" }, 410, h);
      }
      return json(
        {
          status: r.status,
          already_filled: r.status === "preenchido",
          formulario: r.formulario,
          paciente_nome: (r.paciente as { nome?: string } | null)?.nome ?? null,
          // só devolve respostas se já preenchida (evita expor rascunho vazio)
          respostas: r.status === "preenchido" ? r.respostas : null,
        },
        200,
        h
      );
    }

    if (action === "submit") {
      const { data: r } = await supabase
        .from("resposta_anamnese")
        .select("status, expira_em, formulario:formulario_id(perguntas)")
        .eq("token", token)
        .maybeSingle();

      if (!r) return json({ error: "not_found" }, 404, h);
      if (r.expira_em && new Date(r.expira_em).getTime() < Date.now()) {
        return json({ error: "expired" }, 410, h);
      }
      if (r.status === "preenchido") {
        return json({ error: "already_filled" }, 409, h);
      }

      // respostas tem de ser array (fecha type-confusion null/string/número).
      if (!Array.isArray(respostas)) {
        return json({ error: "bad_respostas" }, 400, h);
      }
      // Guard de tamanho: bloqueia payload gigante (DoS/abuso de jsonb).
      if (JSON.stringify(respostas).length > 100_000) {
        return json({ error: "payload_too_large" }, 413, h);
      }

      // Revalida obrigatórias NO SERVIDOR e monta o registro SÓ com as perguntas
      // do schema (whitelist — descarta campo extra/mass-assignment do cliente).
      const perguntas: Pergunta[] =
        ((r.formulario as { perguntas?: Pergunta[] } | null)?.perguntas) ?? [];
      const mapa = new Map(
        (respostas as Resposta[]).map((x) => [
          x?.pergunta_id,
          (x?.resposta ?? "").toString().trim(),
        ])
      );
      const persistidas: Resposta[] = [];
      for (const p of perguntas) {
        const valor = mapa.get(p.id) ?? "";
        if (p.obrigatoria && !valor) {
          return json({ error: "missing_required", pergunta_id: p.id }, 422, h);
        }
        persistidas.push({ pergunta_id: p.id, pergunta_texto: p.texto, resposta: valor });
      }

      // Update ATÔMICO por token + status pendente: o 2º submit concorrente vê
      // status já 'preenchido' e afeta 0 linhas (fecha duplo-submit). Identidade
      // (clinica_id/paciente_id) NUNCA vem do corpo — só estes 3 campos mudam.
      const { data: upd } = await supabase
        .from("resposta_anamnese")
        .update({
          respostas: persistidas,
          status: "preenchido",
          data_preenchimento: new Date().toISOString(),
        })
        .eq("token", token)
        .eq("status", "pendente")
        .select("id");

      if (!upd || upd.length === 0) {
        return json({ error: "already_filled" }, 409, h);
      }
      return json({ ok: true }, 200, h);
    }

    return json({ error: "invalid_action" }, 400, h);
  } catch {
    // NUNCA vaza detalhe interno (o Base44 devolvia error.message no 500).
    return json({ error: "internal_error" }, 500, h);
  }
});
