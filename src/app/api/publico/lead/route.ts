import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * S3-8 — Captação de lead público (nome+telefone, sem login). service_role no
 * servidor. O clinica_id é derivado/validado NO SERVIDOR (do cupom ou da sala
 * VIP) — o cliente não força um tenant arbitrário. origem: marketplace|cupom|
 * lista_vip.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
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
    return NextResponse.json({ erro: "Preencha nome e telefone." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (origem === "lista_vip") {
    const sala_vip_id = String(body.sala_vip_id ?? "");
    const clinica_id = String(body.clinica_id ?? "");
    if (!sala_vip_id || !clinica_id) {
      return NextResponse.json({ erro: "Sala VIP inválida." }, { status: 400 });
    }
    // valida sala VIP pública da clínica (server-side)
    const { data: sala } = await admin
      .from("sala_vip")
      .select("id,clinica_id")
      .eq("id", sala_vip_id)
      .eq("clinica_id", clinica_id)
      .eq("ativa", true)
      .maybeSingle();
    if (!sala) return NextResponse.json({ erro: "Sala VIP indisponível." }, { status: 400 });

    const { error } = await admin.from("lead_sala_vip").insert({
      clinica_id: sala.clinica_id,
      sala_vip_id: sala.id,
      nome,
      telefone,
      email: email || null,
      status: "novo",
      data_interesse: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ erro: "Não foi possível registrar." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // marketplace | cupom → tabela lead. clinica_id do cupom (server) quando cupom.
  let clinicaId: string | null = body.clinica_id ? String(body.clinica_id) : null;
  const cupom_id = body.cupom_id ? String(body.cupom_id) : null;
  if (origem === "cupom" && cupom_id) {
    const { data: cup } = await admin
      .from("cupom")
      .select("clinica_id")
      .eq("id", cupom_id)
      .maybeSingle();
    clinicaId = cup?.clinica_id ?? null; // deriva do cupom — não confia no cliente
  }

  const { error } = await admin.from("lead").insert({
    clinica_id: clinicaId,
    nome,
    telefone,
    origem,
    cupom_id: origem === "cupom" ? cupom_id : null,
    status: "novo",
  });
  if (error) return NextResponse.json({ erro: "Não foi possível registrar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
