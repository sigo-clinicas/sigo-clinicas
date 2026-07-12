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
  const { data: clinica } = await supabase
    .from("clinica")
    .select("id,nome,tipo,cidade,cnpj,telefone,logradouro,email,config")
    .eq("id", sessao.clinicaAtual)
    .single();

  if (!clinica) redirect("/painel");

  const podeEditar = sessao.papel === "proprietario" || sessao.isAdmin;

  return (
    <ConfiguracoesClient
      clinica={clinica as ConfigClinica}
      podeEditar={podeEditar}
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
