import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { UsuariosClient, type UsuarioLinha, type PlanoInfo } from "./usuarios-client";

// Porta de reference/base44 src/pages/GerenciamentoUsuarios.jsx.
// Mudanças do porte: papéis reais do RBAC (proprietário/gerente/recepcionista/
// assistente/profissional — Base44 tinha admin|gestor|recepcionista|profissional);
// limites por papel vêm de plano_assinatura.limites (jsonb); dados via RLS.
export default async function UsuariosPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");
  if (!["proprietario", "gerente"].includes(sessao.papel) && !sessao.isAdmin) {
    redirect("/painel");
  }

  const supabase = createClient();

  const [{ data: vinculos }, { data: assinatura }] = await Promise.all([
    supabase
      .from("clinica_usuario")
      .select("id,user_id,papel,ativo,created_at")
      .eq("clinica_id", sessao.clinicaAtual)
      .order("created_at"),
    supabase
      .from("assinatura_clinica")
      .select(
        "status,proxima_cobranca,plano:plano_assinatura(nome,descricao,preco_mensal,limites)"
      )
      .eq("clinica_id", sessao.clinicaAtual)
      .eq("status", "ativa")
      .maybeSingle(),
  ]);

  // E-mail/nome moram no Auth (auth.users) — enriquecimento server-side,
  // somente leitura, com o admin client.
  const admin = createAdminClient();
  const usuarios: UsuarioLinha[] = await Promise.all(
    (vinculos ?? []).map(async (v) => {
      const { data } = await admin.auth.admin.getUserById(v.user_id);
      return {
        vinculoId: v.id,
        userId: v.user_id,
        papel: v.papel,
        ativo: v.ativo,
        nome:
          (data?.user?.user_metadata?.nome as string | undefined) ??
          data?.user?.email ??
          "—",
        email: data?.user?.email ?? "—",
      };
    })
  );

  const plano: PlanoInfo | null = assinatura?.plano
    ? {
        nome: assinatura.plano.nome,
        descricao: assinatura.plano.descricao,
        precoMensal: Number(assinatura.plano.preco_mensal),
        limites: (assinatura.plano.limites ?? {}) as Record<string, number>,
        proximaCobranca: assinatura.proxima_cobranca,
      }
    : null;

  return (
    <UsuariosClient
      usuarios={usuarios}
      plano={plano}
      papelAtor={sessao.papel}
      isAdmin={sessao.isAdmin}
      meuUserId={sessao.user.id}
    />
  );
}
