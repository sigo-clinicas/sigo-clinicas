import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolverClinicaLead } from "@/lib/leads";
import { corsHeaders } from "@/lib/cors";
import { consumirRateLimit, ipDoRequest } from "@/lib/rate-limit";

/**
 * S3-8 — Captação de lead público (nome+telefone, sem login). service_role no
 * servidor. O clinica_id é derivado/validado NO SERVIDOR (do cupom ou da sala
 * VIP) — o cliente não força um tenant arbitrário. origem: marketplace|cupom|
 * lista_vip. S4-6: CORS restrito por origem + rate-limit.
 */
export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req.headers.get("origin"));

  // Rate-limit por IP (spam de leads): 10/min. Fail-open.
  if (!(await consumirRateLimit(`lead:${ipDoRequest(req)}`, 10, 60))) {
    return NextResponse.json(
      { erro: "Muitas tentativas. Aguarde um instante." },
      { status: 429, headers: cors }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400, headers: cors });
  }

  const nome = String(body.nome ?? "").trim();
  const telefone = String(body.telefone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const origemRaw = String(body.origem ?? "marketplace");
  const origem = (["marketplace", "cupom", "lista_vip"] as const).includes(
    origemRaw as "marketplace" | "cupom" | "lista_vip"
  )
    ? (origemRaw as "marketplace" | "cupom" | "lista_vip")
    : "marketplace";

  if (!nome || !telefone) {
    return NextResponse.json({ erro: "Preencha nome e telefone." }, { status: 400, headers: cors });
  }

  const admin = createAdminClient();

  if (origem === "lista_vip") {
    const sala_vip_id = String(body.sala_vip_id ?? "");
    const clinica_id = String(body.clinica_id ?? "");
    if (!sala_vip_id || !clinica_id) {
      return NextResponse.json({ erro: "Sala VIP inválida." }, { status: 400, headers: cors });
    }
    // valida sala VIP pública da clínica (server-side)
    const { data: sala } = await admin
      .from("sala_vip")
      .select("id,clinica_id")
      .eq("id", sala_vip_id)
      .eq("clinica_id", clinica_id)
      .eq("ativa", true)
      .maybeSingle();
    if (!sala) return NextResponse.json({ erro: "Sala VIP indisponível." }, { status: 400, headers: cors });

    const { error } = await admin.from("lead_sala_vip").insert({
      clinica_id: sala.clinica_id,
      sala_vip_id: sala.id,
      nome,
      telefone,
      email: email || null,
      status: "novo",
      data_interesse: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ erro: "Não foi possível registrar." }, { status: 500, headers: cors });
    return NextResponse.json({ ok: true }, { headers: cors });
  }

  // marketplace | cupom → tabela lead. O clinica_id é SEMPRE resolvido no
  // servidor (resolverClinicaLead): derivado do cupom ou validado contra clínica
  // pública. Nunca gravado direto do corpo do request.
  const cupom_id = body.cupom_id ? String(body.cupom_id) : null;
  const clinicaId = await resolverClinicaLead(admin, {
    origem,
    clinica_id: body.clinica_id ? String(body.clinica_id) : null,
    cupom_id,
  });

  const { error } = await admin.from("lead").insert({
    clinica_id: clinicaId,
    nome,
    telefone,
    origem,
    cupom_id: origem === "cupom" ? cupom_id : null,
    status: "novo",
  });
  if (error) return NextResponse.json({ erro: "Não foi possível registrar." }, { status: 500, headers: cors });
  return NextResponse.json({ ok: true }, { headers: cors });
}
