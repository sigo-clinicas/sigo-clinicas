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

  const [
    { data: profissionais },
    { data: avaliacoes },
    { data: documentos },
    { data: convenio },
    { data: clinica },
    { data: evolucoesRaw },
    { data: galeria },
    { data: itensEstoque },
    { data: consultas },
    { data: respostasRaw },
    { data: formulariosAtivos },
  ] = await Promise.all([
    supabase
      .from("profissional")
      .select("id,nome,nome_conselho,numero_registro")
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
    supabase.from("clinica").select("tipo,nome").eq("id", clinicaId).single(),
    supabase
      .from("evolucao_sessao")
      .select(
        "id,data_hora,profissional_id,consulta_id,numero_sessao,descricao_atendimento,reacao_paciente,intercorrencias,orientacoes_pos,prescricao,proxima_sessao_sugerida,fotos"
      )
      .eq("clinica_id", clinicaId)
      .eq("paciente_id", params.pacienteId)
      .order("data_hora", { ascending: false }),
    supabase
      .from("galeria_foto")
      .select("id,path,categoria,descricao,data")
      .eq("clinica_id", clinicaId)
      .eq("paciente_id", params.pacienteId)
      .order("data", { ascending: false }),
    supabase
      .from("item_estoque")
      .select("id,descricao,unidade")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true)
      .order("descricao"),
    supabase
      .from("consulta")
      .select("id,data_hora,profissional_id")
      .eq("clinica_id", clinicaId)
      .eq("paciente_id", params.pacienteId)
      .eq("status", "concluido")
      .order("data_hora", { ascending: false }),
    supabase
      .from("resposta_anamnese")
      .select("id,status,token,data_preenchimento,respostas,formulario:formulario_id(nome)")
      .eq("clinica_id", clinicaId)
      .eq("paciente_id", params.pacienteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("formulario_anamnese")
      .select("id,nome")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true)
      .order("nome"),
  ]);

  // Insumos das evoluções (tabela normalizada) — anexados a cada evolução
  const evolucaoIds = (evolucoesRaw ?? []).map((e) => e.id);
  const { data: insumos } = evolucaoIds.length
    ? await supabase
        .from("evolucao_insumo")
        .select("id,evolucao_id,produto_nome,fabricante,quantidade,lote,validade,item_estoque_id,movimentacao_estoque_id")
        .in("evolucao_id", evolucaoIds)
    : { data: [] };

  const evolucoes = (evolucoesRaw ?? []).map((e) => ({
    ...e,
    fotos: (e.fotos as AvaliacaoFotos) ?? [],
    insumos: (insumos ?? []).filter((i) => i.evolucao_id === e.id),
  }));

  const respostasAnamnese = (respostasRaw ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    token: r.token,
    data_preenchimento: r.data_preenchimento,
    respostas: (r.respostas as { pergunta_texto?: string; resposta?: string }[] | null) ?? [],
    formulario_nome: (r.formulario as { nome?: string } | null)?.nome ?? null,
  }));

  const podeEditar =
    ["proprietario", "gerente", "recepcionista", "assistente", "profissional"].includes(
      sessao.papel
    ) || sessao.isAdmin;

  return (
    <ProntuarioShell
      clinicaId={clinicaId}
      clinicaNome={clinica?.nome ?? "Clínica"}
      paciente={paciente}
      convenioNome={convenio?.nome ?? null}
      profissionais={profissionais ?? []}
      avaliacoes={(avaliacoes ?? []).map((a) => ({
        ...a,
        fotos: (a.fotos as AvaliacaoFotos) ?? [],
      }))}
      documentos={documentos ?? []}
      evolucoes={evolucoes}
      itensEstoque={itensEstoque ?? []}
      consultas={consultas ?? []}
      fotosGaleria={galeria ?? []}
      respostasAnamnese={respostasAnamnese}
      formulariosAtivos={formulariosAtivos ?? []}
      termo={TERMINOLOGIA[(clinica?.tipo ?? "medica") as TipoClinica]}
      tipoClinica={(clinica?.tipo ?? "medica") as TipoClinica}
      podeEditar={podeEditar}
    />
  );
}
