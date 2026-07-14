import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TERMINOLOGIA, type TipoClinica } from "@/lib/terminologia";

import { AgendaClient } from "./agenda-client";

// Porta de reference/base44 src/pages/Agenda.jsx + ConsultaModal.jsx.
// Multiagenda: grade dia/semana/mês com filtro por profissional. A venda de
// produto / orçamento pré-pago do ConsultaModal original depende do funil
// comercial (S3) e entra lá; aqui é o núcleo de agendamento.
export default async function AgendaPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const [
    { data: consultas },
    { data: profissionais },
    { data: pacientes },
    { data: servicos },
    { data: convenios },
    { data: clinica },
  ] = await Promise.all([
    supabase
      .from("consulta")
      .select(
        `id,paciente_id,profissional_id,convenio_id,numero_guia,data_hora,duracao_minutos,tipo,status,valor,observacoes,
         paciente:paciente(nome),
         consulta_servico(servico_id)`
      )
      .eq("clinica_id", clinicaId)
      .order("data_hora", { ascending: false })
      .limit(500),
    supabase
      .from("profissional")
      .select(
        `id,nome,cor,user_id,dias_atendimento,horario_inicio,horario_fim,
         profissional_servico(servico_id),
         profissional_intervalo(tipo,dia_semana,hora_inicio,hora_fim,data_hora_inicio,data_hora_fim)`
      )
      .eq("clinica_id", clinicaId)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("paciente_clinica")
      .select("paciente:paciente(id,nome)")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true),
    supabase
      .from("servico")
      .select("id,nome,duracao_minutos")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("convenio")
      .select("id,nome")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true)
      .order("nome"),
    supabase.from("clinica").select("tipo").eq("id", clinicaId).single(),
  ]);

  const tipo = (clinica?.tipo ?? "medica") as TipoClinica;
  const termo = TERMINOLOGIA[tipo];
  const podeEditar =
    ["proprietario", "gerente", "recepcionista", "assistente"].includes(
      sessao.papel
    ) || sessao.isAdmin;

  return (
    <AgendaClient
      consultas={(consultas ?? []).map((c) => ({
        id: c.id,
        paciente_id: c.paciente_id,
        paciente_nome: c.paciente?.nome ?? "—",
        profissional_id: c.profissional_id,
        convenio_id: c.convenio_id,
        numero_guia: c.numero_guia,
        data_hora: c.data_hora,
        duracao_minutos: c.duracao_minutos,
        tipo: c.tipo,
        status: c.status,
        valor: c.valor,
        observacoes: c.observacoes,
        servico_ids: c.consulta_servico.map((s) => s.servico_id),
      }))}
      profissionais={(profissionais ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        cor: p.cor,
        user_id: p.user_id,
        dias_atendimento: p.dias_atendimento,
        horario_inicio: p.horario_inicio,
        horario_fim: p.horario_fim,
        servico_ids: p.profissional_servico.map((s) => s.servico_id),
        intervalos: p.profissional_intervalo,
      }))}
      pacientes={(pacientes ?? [])
        .map((v) => v.paciente)
        .filter((p): p is { id: string; nome: string } => p !== null)}
      servicos={servicos ?? []}
      convenios={convenios ?? []}
      podeEditar={podeEditar}
      meuUserId={sessao.user.id}
      ehProfissional={sessao.papel === "profissional"}
      termoPaciente={termo.paciente}
    />
  );
}
