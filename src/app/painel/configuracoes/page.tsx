import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ConfiguracoesClient, type ConfigClinica } from "./configuracoes-client";

// Porta de reference/base44 src/pages/Configuracoes.jsx.
// Mudanças do porte: config sai do localStorage (ClinicaContext) e vive em
// clinica.config (jsonb, migration 20260712100100); edição restrita ao
// proprietário (matriz do legado — gerente vê somente leitura).
export default async function ConfiguracoesPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const [{ data: clinica }, { data: segmentos }, { data: especialidades }, { data: selecionadas }] =
    await Promise.all([
      supabase
        .from("clinica")
        .select(
          "id,nome,tipo,razao_social,cnpj,telefone,email,cep,uf,cidade,bairro,logradouro,numero,complemento,sobre,slug,logo_path,exibir_marketplace,config"
        )
        .eq("id", sessao.clinicaAtual)
        .single(),
      supabase.from("segmento").select("id,nome").eq("ativo", true).order("nome"),
      supabase
        .from("especialidade")
        .select("id,segmento_id,nome")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("clinica_especialidade")
        .select("especialidade_id")
        .eq("clinica_id", sessao.clinicaAtual),
    ]);

  if (!clinica) redirect("/painel");

  const podeEditar = sessao.papel === "proprietario" || sessao.isAdmin;
  const podeEditarEspecialidades =
    podeEditar || sessao.papel === "gerente";

  return (
    <ConfiguracoesClient
      clinica={clinica as ConfigClinica}
      podeEditar={podeEditar}
      podeEditarEspecialidades={podeEditarEspecialidades}
      segmentos={segmentos ?? []}
      especialidades={especialidades ?? []}
      especialidadesSelecionadas={(selecionadas ?? []).map(
        (s) => s.especialidade_id
      )}
      usuario={{
        nome:
          (sessao.user.user_metadata?.nome as string | undefined) ??
          sessao.user.email ??
          "Usuário",
        email: sessao.user.email ?? "",
        papel: sessao.papel,
      }}
    />
  );
}
