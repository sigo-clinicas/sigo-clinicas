import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TERMINOLOGIA, type TipoClinica } from "@/lib/terminologia";

import { PacientesClient, type OrigemConfig } from "./pacientes-client";

// Porta de reference/base44 src/pages/Pacientes.jsx + PacienteModal.jsx.
// Mudança central (A1/M3): paciente é GLOBAL; a lista vem via
// paciente_clinica (só os vinculados à clínica atual); convênio/carteirinha e
// origem são dados do vínculo, não do cadastro global. O envio de link de
// anamnese do modal original entra no S2 (prontuário).
export default async function PacientesPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const [{ data: vinculos }, { data: convenios }, { data: clinica }] =
    await Promise.all([
      supabase
        .from("paciente_clinica")
        .select(
          `id,convenio_id,numero_carteirinha,origem,ativo,
           paciente:paciente(id,nome,cpf,data_nascimento,telefone,email,logradouro,sexo,
             nome_mae,contato_emergencia_nome,contato_emergencia_telefone,
             contato_emergencia_parentesco,observacoes,ativo)`
        )
        .eq("clinica_id", clinicaId)
        .order("created_at", { ascending: false }),
      supabase
        .from("convenio")
        .select("id,nome")
        .eq("clinica_id", clinicaId)
        .eq("ativo", true)
        .order("nome"),
      supabase.from("clinica").select("tipo,config").eq("id", clinicaId).single(),
    ]);

  const tipo = (clinica?.tipo ?? "medica") as TipoClinica;
  const termo = TERMINOLOGIA[tipo];
  const origens =
    ((clinica?.config as { origens_pacientes?: OrigemConfig[] } | null)
      ?.origens_pacientes) ?? [];

  const pacientes = (vinculos ?? [])
    .filter((v) => v.paciente !== null)
    .map((v) => ({
      vinculoId: v.id,
      convenioId: v.convenio_id,
      numeroCarteirinha: v.numero_carteirinha,
      origem: v.origem,
      ...v.paciente!,
    }));

  return (
    <PacientesClient
      pacientes={pacientes}
      convenios={convenios ?? []}
      origens={origens}
      termo={{ singular: termo.paciente, plural: termo.pacientes }}
    />
  );
}
