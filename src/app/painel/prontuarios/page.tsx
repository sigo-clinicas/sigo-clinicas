import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TERMINOLOGIA, type TipoClinica } from "@/lib/terminologia";

import { ProntuariosClient } from "./prontuarios-client";

// Porta de reference/base44 src/pages/Prontuarios.jsx — índice/busca de
// pacientes vinculados à clínica; clica → /painel/prontuarios/[pacienteId].
export default async function ProntuariosPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const { data: vinculos } = await supabase
    .from("paciente_clinica")
    .select("paciente:paciente(id,nome,cpf,telefone,data_nascimento)")
    .eq("clinica_id", sessao.clinicaAtual)
    .eq("ativo", true);

  const { data: clinica } = await supabase
    .from("clinica")
    .select("tipo")
    .eq("id", sessao.clinicaAtual)
    .single();
  const termo = TERMINOLOGIA[(clinica?.tipo ?? "medica") as TipoClinica];

  const pacientes = (vinculos ?? [])
    .map((v) => v.paciente)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <ProntuariosClient
      pacientes={pacientes}
      termoPlural={termo.prontuario}
      termoPaciente={termo.paciente}
    />
  );
}
