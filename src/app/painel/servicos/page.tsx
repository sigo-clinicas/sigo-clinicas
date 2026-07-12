import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ServicosClient } from "./servicos-client";

// Porta de reference/base44 src/pages/Servicos.jsx.
// Mudanças do porte: Servico unificado (A4 — sem entidade Procedimento);
// especialidade string → FK do cadastro dinâmico; `requer_validade` NÃO
// portado (campo pertence a item_estoque — entra no estoque, S2); aba
// Composição do ServicoModal entra com o estoque-núcleo (S2).
export default async function ServicosPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const [{ data: servicos }, { data: tabelas }, { data: convenios }, { data: especialidades }] =
    await Promise.all([
      supabase
        .from("servico")
        .select("id,nome,codigo,duracao_minutos,especialidade_id,exibir_publico,observacoes,ativo")
        .eq("clinica_id", clinicaId)
        .order("nome"),
      supabase
        .from("tabela_preco")
        .select(
          `id,nome,convenio_id,descricao,exibir_publico,ativo,
           convenio(nome),
           item_tabela_preco(id,servico_id,tipo_valor,valor)`
        )
        .eq("clinica_id", clinicaId)
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
    <ServicosClient
      servicos={servicos ?? []}
      tabelas={(tabelas ?? []).map((t) => ({
        id: t.id,
        nome: t.nome,
        convenio_id: t.convenio_id,
        convenio_nome: t.convenio?.nome ?? null,
        descricao: t.descricao,
        exibir_publico: t.exibir_publico,
        ativo: t.ativo,
        itens: t.item_tabela_preco,
      }))}
      convenios={convenios ?? []}
      especialidades={(especialidades ?? [])
        .map((e) => e.especialidade)
        .filter((e): e is { id: string; nome: string } => e !== null)}
      podeGerenciar={podeGerenciar}
    />
  );
}
