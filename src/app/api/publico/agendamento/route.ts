import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail } from "@/lib/email";

/**
 * S3-8 — Endpoint público de agendamento (sem login). service_role SÓ aqui no
 * servidor; chama a RPC transacional agendar_publico (que valida clínica/
 * profissional públicos, trava double-booking e cria paciente+consulta). Erros
 * genéricos (não vaza detalhe). CORS de produção = hardening (§fechamento).
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const clinica_id = String(body.clinica_id ?? "");
  const profissional_id = String(body.profissional_id ?? "");
  const data_hora = String(body.data_hora ?? "");
  const nome = String(body.nome ?? "").trim();
  const telefone = String(body.telefone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const cpf = String(body.cpf ?? "").trim();
  const observacoes = String(body.observacoes ?? "").trim();
  const servico_ids = Array.isArray(body.servico_ids)
    ? (body.servico_ids as unknown[]).map(String)
    : [];

  if (!clinica_id || !profissional_id || !data_hora || !nome || !telefone) {
    return NextResponse.json({ erro: "Preencha nome, telefone e horário." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("agendar_publico", {
    p_clinica_id: clinica_id,
    p_profissional_id: profissional_id,
    p_data_hora: data_hora,
    p_servico_ids: servico_ids,
    p_nome: nome,
    p_telefone: telefone,
    p_email: email,
    p_cpf: cpf,
    p_obs: observacoes,
  });

  if (error) {
    return NextResponse.json(
      { erro: "Não foi possível agendar. O horário pode estar indisponível." },
      { status: 409 }
    );
  }

  // e-mail best-effort (no-op sem RESEND_API_KEY)
  const { data: clin } = await admin
    .from("clinica")
    .select("nome,email")
    .eq("id", clinica_id)
    .maybeSingle();
  const nomeClinica = clin?.nome ?? "a clínica";
  if (email) {
    void enviarEmail({
      para: email,
      assunto: `Agendamento em ${nomeClinica}`,
      html: `<p>Olá ${nome}, recebemos sua solicitação de horário. Em breve ${nomeClinica} confirma.</p>`,
    });
  }
  if (clin?.email) {
    void enviarEmail({
      para: clin.email,
      assunto: "Novo agendamento online",
      html: `<p>${nome} (${telefone}) solicitou um horário pelo site.</p>`,
    });
  }

  return NextResponse.json({ ok: true, consulta_id: data });
}
