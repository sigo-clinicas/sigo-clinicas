import { redirect, notFound } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TERMINOLOGIA, type TipoClinica } from "@/lib/terminologia";

import { ProntuarioShell } from "@/components/prontuario/prontuario-shell";
import type { FotoProntuario } from "@/lib/actions/prontuario";

type AvaliacaoFotos = FotoProntuario[] | null;

// Porta de reference/base44 src/pages/PacientePerfil.jsx (shell do prontuário).
// A RLS + o vínculo paciente_clinica garantem que só um paciente da clínica é
// carregado (paciente global vinculado). Abas de S3 (Planos) e S2-3 (Evolução/
// Receituário/Galeria) aparecem como "em construção".
export default async function ProntuarioPacientePage({
  params,
}: {
  params: { pacienteId: string };
}) {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  // Vínculo confirma que o paciente é da clínica (senão o RLS não devolve nada)
  const { data: vinculo } = await supabase
    .from("paciente_clinica")
    .select("convenio_id, numero_carteirinha")
    .eq("clinica_id", clinicaId)
    .eq("paciente_id", params.pacienteId)
    .maybeSingle();
  if (!vinculo) notFound();

  const { data: pacienteRow } = await supabase
    .from("paciente")
    .select(
      "id,nome,cpf,data_nascimento,sexo,telefone,email,logradouro,nome_mae,contato_emergencia_nome,contato_emergencia_telefone,contato_emergencia_parentesco,observacoes"
    )
    .eq("id", params.pacienteId)
    .maybeSingle();
  if (!pacienteRow) notFound();

  // numero_carteirinha é do vínculo (convênio por clínica), não do paciente global
  const paciente = { ...pacienteRow, numero_carteirinha: vinculo.numero_carteirinha };

  const [{ data: profissionais }, { data: avaliacoes }, { data: documentos }, { data: convenio }, { data: clinica }] =
    await Promise.all([
      supabase
        .from("profissional")
        .select("id,nome")
        .eq("clinica_id", clinicaId)
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("avaliacao_clinica")
        .select("*")
        .eq("clinica_id", clinicaId)
        .eq("paciente_id", params.pacienteId)
        .order("data", { ascending: false }),
      supabase
        .from("documento_consentimento")
        .select("id,tipo,titulo,conteudo,status,data_assinatura,arquivo_path,assinatura_path,observacoes,created_at")
        .eq("clinica_id", clinicaId)
        .eq("paciente_id", params.pacienteId)
        .order("created_at", { ascending: false }),
      vinculo.convenio_id
        ? supabase.from("convenio").select("nome").eq("id", vinculo.convenio_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("clinica").select("tipo").eq("id", clinicaId).single(),
    ]);

  const podeEditar =
    ["proprietario", "gerente", "recepcionista", "assistente", "profissional"].includes(
      sessao.papel
    ) || sessao.isAdmin;

  return (
    <ProntuarioShell
      clinicaId={clinicaId}
      paciente={paciente}
      convenioNome={convenio?.nome ?? null}
      profissionais={profissionais ?? []}
      avaliacoes={(avaliacoes ?? []).map((a) => ({
        ...a,
        fotos: (a.fotos as AvaliacaoFotos) ?? [],
      }))}
      documentos={documentos ?? []}
      termo={TERMINOLOGIA[(clinica?.tipo ?? "medica") as TipoClinica]}
      tipoClinica={(clinica?.tipo ?? "medica") as TipoClinica}
      podeEditar={podeEditar}
    />
  );
}
