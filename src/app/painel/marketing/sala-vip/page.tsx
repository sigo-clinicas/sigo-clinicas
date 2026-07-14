import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { SalaVipClient } from "./sala-vip-client";

// Porta de reference/base44 src/pages/admin/SalaVIP.jsx (agora tenant-scoped:
// aprovação pelo proprietário/gerente da própria clínica).
export default async function SalaVipPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");
  const podeGerir =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;
  if (!podeGerir) redirect("/painel");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;
  const [{ data: salas }, { data: leads }] = await Promise.all([
    supabase
      .from("sala_vip")
      .select("id,nome,descricao,beneficios,quantidade_vagas,status,ativa,created_at")
      .eq("clinica_id", clinicaId)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_sala_vip")
      .select("id,sala_vip_id,nome,telefone,email,status,data_interesse")
      .eq("clinica_id", clinicaId)
      .order("data_interesse", { ascending: false }),
  ]);

  return <SalaVipClient salas={salas ?? []} leads={leads ?? []} />;
}
