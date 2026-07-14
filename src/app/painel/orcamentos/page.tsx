import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TERMINOLOGIA } from "@/lib/terminologia";

import { OrcamentosClient } from "./orcamentos-client";

// Porta de reference/base44 src/pages/Orcamentos.jsx (page + tabs + filtros +
// OrcamentoForm) + OrcamentoKanban.jsx. Mudanças estruturais:
// (1) itens[] normalizado em item_orcamento; (2) totais calculados no servidor
// (RPC salvar_orcamento); (3) regioes (odontograma/mapa estética) persistidas.
// O botão "Vender" e a aba "Vendas & Faturamento" entram no S3-2.
export default async function OrcamentosPage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual;

  const [
    { data: orcamentos },
    { data: itens },
    { data: profissionais },
    { data: convenios },
    { data: vinculos },
    { data: servicos },
    { data: tabelasPreco },
    { data: itensTabela },
    { data: itensEstoque },
    { data: saldos },
    { data: clinica },
  ] = await Promise.all([
    supabase
      .from("orcamento")
      .select(
        "id,paciente_id,cliente_nome,cliente_telefone,cliente_email,profissional_id,convenio_id,tabela_preco_id,status,validade_dias,valor_total,tipo_desconto,desconto,valor_final,observacoes,anotacoes_internas,created_at"
      )
      .eq("clinica_id", clinicaId)
      .order("created_at", { ascending: false }),
    supabase
      .from("item_orcamento")
      .select(
        "id,orcamento_id,servico_id,item_estoque_id,quantidade,valor_unitario,valor_total,tipo_valor,regioes,unidade,observacao"
      )
      .eq("clinica_id", clinicaId),
    supabase
      .from("profissional")
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
      .from("paciente_clinica")
      .select("convenio_id,paciente:paciente_id(id,nome,telefone,email)")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true),
    supabase
      .from("servico")
      .select("id,nome")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("tabela_preco")
      .select("id,nome,convenio_id")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true),
    supabase
      .from("item_tabela_preco")
      .select("tabela_preco_id,servico_id,tipo_valor,valor")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true),
    supabase
      .from("item_estoque")
      .select("id,descricao,unidade,preco_venda,preco_custo")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true)
      .order("descricao"),
    supabase
      .from("saldo_item_estoque")
      .select("item_id,saldo_atual")
      .eq("clinica_id", clinicaId),
    supabase.from("clinica").select("tipo").eq("id", clinicaId).single(),
  ]);

  // Agrupa itens por orçamento
  const itensPorOrcamento = new Map<string, typeof itens>();
  for (const it of itens ?? []) {
    const lista = itensPorOrcamento.get(it.orcamento_id) ?? [];
    lista.push(it);
    itensPorOrcamento.set(it.orcamento_id, lista);
  }
  const orcamentosComItens = (orcamentos ?? []).map((o) => ({
    ...o,
    itens: itensPorOrcamento.get(o.id) ?? [],
  }));

  // Pacientes da clínica (via vínculo N:N)
  const pacientes = (vinculos ?? [])
    .filter((v) => v.paciente)
    .map((v) => ({
      id: v.paciente!.id,
      nome: v.paciente!.nome,
      telefone: v.paciente!.telefone,
      email: v.paciente!.email,
      convenio_id: v.convenio_id,
    }));

  // Saldo por item de estoque (view — nunca coluna)
  const saldoPorItem = new Map(
    (saldos ?? []).map((s) => [s.item_id, Number(s.saldo_atual)])
  );
  const produtosEstoque = (itensEstoque ?? []).map((i) => ({
    ...i,
    saldo: saldoPorItem.get(i.id) ?? 0,
  }));

  const tipoClinica = clinica?.tipo ?? "medica";
  const termo = TERMINOLOGIA[tipoClinica];

  return (
    <OrcamentosClient
      orcamentos={orcamentosComItens}
      profissionais={profissionais ?? []}
      convenios={convenios ?? []}
      pacientes={pacientes}
      servicos={servicos ?? []}
      tabelasPreco={tabelasPreco ?? []}
      itensTabela={(itensTabela ?? []).map((i) => ({ ...i, valor: i.valor ?? 0 }))}
      produtosEstoque={produtosEstoque}
      tipoClinica={tipoClinica}
      termo={termo}
      podeExcluir={
        ["proprietario", "gerente", "recepcionista", "assistente"].includes(
          sessao.papel
        ) || sessao.isAdmin
      }
    />
  );
}
