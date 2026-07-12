import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ProfissionaisClient } from "./profissionais-client";

// Porta de reference/base44 src/pages/Profissionais.jsx.
// Mudanças do porte: especialidade string livre → N:N com o cadastro
// dinâmico (A4); serviços/comissões e convênios em tabelas N:N; aba nova
// "Bloqueios" (profissional_has_intervalo do legado).
export default async function ProfissionaisPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const [{ data: profissionais }, { data: servicos }, { data: convenios }, { data: especialidades }] =
    await Promise.all([
      supabase
        .from("profissional")
        .select(
          `id,nome,numero_registro,telefone,email,cor,horario_inicio,horario_fim,dias_atendimento,ativo,user_id,
           profissional_especialidade(especialidade_id),
           profissional_convenio(convenio_id),
           profissional_servico(servico_id,tipo_comissao,valor_comissao),
           profissional_intervalo(id,tipo,motivo,dia_semana,hora_inicio,hora_fim,data_hora_inicio,data_hora_fim)`
        )
        .eq("clinica_id", clinicaId)
        .order("nome"),
      supabase
        .from("servico")
        .select("id,nome")
        .eq("clinica_id", clinicaId)
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("convenio")
        .select("id,nome")
        .eq("clinica_id", clinicaId)
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("clinica_especialidade")
        .select("especialidade:especialidade(id,nome)")
        .eq("clinica_id", clinicaId),
    ]);

  const podeGerenciar =
    ["proprietario", "gerente"].includes(sessao.papel) || sessao.isAdmin;

  return (
    <ProfissionaisClient
      profissionais={profissionais ?? []}
      servicos={servicos ?? []}
      convenios={convenios ?? []}
      especialidadesDaClinica={(especialidades ?? [])
        .map((e) => e.especialidade)
        .filter((e): e is { id: string; nome: string } => e !== null)}
      podeGerenciar={podeGerenciar}
      meuUserId={sessao.user.id}
    />
  );
}
