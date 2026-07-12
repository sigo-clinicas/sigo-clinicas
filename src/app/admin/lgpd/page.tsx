import { createClient } from "@/lib/supabase/server";

import { LgpdAdminClient, type SolicitacaoLinha } from "./lgpd-admin-client";

// S2-5 — Painel LGPD do admin de plataforma: pedidos self-service (art. 18) e
// anonimização (art. 16/18). is_admin passa a RLS de consentimento_evento em
// qualquer clínica. A PURGA automática por prazo NÃO é implementada (prazos
// pendentes da cliente).
export default async function LgpdAdminPage() {
  const supabase = createClient();

  const { data: eventos } = await supabase
    .from("consentimento_evento")
    .select("id,tipo,origem,detalhe,created_at,paciente:paciente_id(id,nome,anonimizado)")
    .in("tipo", ["exportacao", "exclusao"])
    .eq("origem", "self")
    .order("created_at", { ascending: false })
    .limit(100);

  const solicitacoes: SolicitacaoLinha[] = (eventos ?? []).map((e) => {
    const pac = e.paciente as { id?: string; nome?: string; anonimizado?: boolean } | null;
    return {
      id: e.id,
      tipo: e.tipo as "exportacao" | "exclusao",
      detalhe: e.detalhe,
      created_at: e.created_at,
      pacienteId: pac?.id ?? "",
      pacienteNome: pac?.nome ?? "—",
      anonimizado: pac?.anonimizado ?? false,
    };
  });

  return <LgpdAdminClient solicitacoes={solicitacoes} />;
}
