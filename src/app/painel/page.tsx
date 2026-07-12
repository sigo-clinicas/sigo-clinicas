import { redirect } from "next/navigation";
import { Calendar, Users, Stethoscope, CheckCircle2 } from "lucide-react";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TERMINOLOGIA, type TipoClinica } from "@/lib/terminologia";

// Porta (leve) de reference/base44 src/pages/Dashboard.jsx + ConsultasHoje.jsx:
// KPIs do dia + lista de consultas de hoje. Relatórios completos = D4.3.
export default async function PainelHome() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const hoje = new Date();
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimDia = new Date(inicioDia.getTime() + 24 * 3600000);

  const [{ data: consultasHoje }, { count: totalPacientes }, { count: totalProfissionais }, { data: clinica }] =
    await Promise.all([
      supabase
        .from("consulta")
        .select("id,data_hora,status,tipo,paciente:paciente(nome)")
        .eq("clinica_id", clinicaId)
        .gte("data_hora", inicioDia.toISOString())
        .lt("data_hora", fimDia.toISOString())
        .order("data_hora"),
      supabase
        .from("paciente_clinica")
        .select("id", { count: "exact", head: true })
        .eq("clinica_id", clinicaId)
        .eq("ativo", true),
      supabase
        .from("profissional")
        .select("id", { count: "exact", head: true })
        .eq("clinica_id", clinicaId)
        .eq("ativo", true),
      supabase.from("clinica").select("tipo").eq("id", clinicaId).single(),
    ]);

  const termo = TERMINOLOGIA[(clinica?.tipo ?? "medica") as TipoClinica];
  const consultas = consultasHoje ?? [];
  const concluidas = consultas.filter((c) => c.status === "concluido").length;

  const kpis = [
    { label: `${termo.atendimentos} hoje`, valor: consultas.length, icon: Calendar },
    { label: "Concluídos hoje", valor: concluidas, icon: CheckCircle2 },
    { label: termo.pacientes, valor: totalPacientes ?? 0, icon: Users },
    { label: termo.profissionais, valor: totalProfissionais ?? 0, icon: Stethoscope },
  ];

  const STATUS_LABEL: Record<string, string> = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    em_atendimento: "Em Atend.",
    concluido: "Concluído",
    cancelado: "Cancelado",
    faltou: "Faltou",
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {kpi.valor}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">{termo.atendimentos} de hoje</h2>
        </div>
        {consultas.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum agendamento para hoje.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {consultas.map((c) => (
              <li key={c.id} className="px-5 py-3 flex items-center gap-4">
                <span className="text-sm font-mono text-muted-foreground w-14">
                  {new Date(c.data_hora).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="flex-1 text-sm font-medium">
                  {c.paciente?.nome ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
