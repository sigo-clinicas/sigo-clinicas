"use server";

import { revalidatePath } from "next/cache";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  calcularComissao,
  intervaloCompetencia,
  type TipoComissao,
} from "@/lib/comissao";
import type { Json } from "@/lib/database.types";

/**
 * S3-5 — Comissões. previaComissao calcula as linhas (por consulta_servico de
 * consultas concluídas × taxa em profissional_servico × valor do item_orcamento
 * ligado); apurarComissao persiste + gera o lançamento (despesa) via RPC
 * transacional. Base lida de clinica.config->>'base_comissao'. Escrita:
 * proprietário/gerente. `por_evolucao` usa a mesma fonte de consultas concluídas
 * no S3 (valorização por evolução: refinamento sinalizado p/ homologação).
 */

export type EstadoComissao = { erro: string | null; ok?: boolean; id?: string };

export type LinhaComissao = {
  consulta_servico_id: string;
  consulta_id: string;
  descricao: string;
  base_calculo: number;
  tipo_comissao: TipoComissao;
  valor: number;
  ja_comissionado: boolean;
};

export type PreviaComissao = {
  erro: string | null;
  base: string;
  linhas: LinhaComissao[];
};

async function exigirFinanceiro() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual) return { sessao: null, erro: "Sessão inválida." } as const;
  if (!["proprietario", "gerente"].includes(sessao.papel ?? "") && !sessao.isAdmin) {
    return { sessao: null, erro: "Sem permissão para comissões." } as const;
  }
  return { sessao, erro: null } as const;
}

export async function previaComissao(
  profissionalId: string,
  competencia: string // YYYY-MM
): Promise<PreviaComissao> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro, base: "", linhas: [] };

  const supabase = createClient();
  const clinicaId = sessao.clinicaAtual!;
  const { inicio, fim } = intervaloCompetencia(competencia);

  const { data: clinica } = await supabase
    .from("clinica")
    .select("config")
    .eq("id", clinicaId)
    .single();
  const config = (clinica?.config ?? {}) as Record<string, unknown>;
  const base = (config.base_comissao as string) || "por_agendamento";

  const { data: consultas } = await supabase
    .from("consulta")
    .select("id,data_hora")
    .eq("clinica_id", clinicaId)
    .eq("profissional_id", profissionalId)
    .eq("status", "concluido")
    .gte("data_hora", inicio)
    .lt("data_hora", fim);

  const consultaIds = (consultas ?? []).map((c) => c.id);
  if (consultaIds.length === 0) return { erro: null, base, linhas: [] };
  const dataPorConsulta = new Map((consultas ?? []).map((c) => [c.id, c.data_hora]));

  const [{ data: cs }, { data: rates }, { data: existentes }] = await Promise.all([
    supabase
      .from("consulta_servico")
      .select("id,consulta_id,servico_id,item_orcamento_id")
      .eq("clinica_id", clinicaId)
      .in("consulta_id", consultaIds),
    supabase
      .from("profissional_servico")
      .select("servico_id,tipo_comissao,valor_comissao")
      .eq("clinica_id", clinicaId)
      .eq("profissional_id", profissionalId),
    supabase
      .from("comissao")
      .select("consulta_servico_id")
      .eq("clinica_id", clinicaId)
      .eq("profissional_id", profissionalId)
      .not("consulta_servico_id", "is", null),
  ]);

  const ratePorServico = new Map(
    (rates ?? []).map((r) => [
      r.servico_id,
      { tipo: r.tipo_comissao as TipoComissao, valor: Number(r.valor_comissao) },
    ])
  );
  const jaComissionados = new Set(
    (existentes ?? []).map((e) => e.consulta_servico_id)
  );

  const itemIds = [
    ...new Set((cs ?? []).map((x) => x.item_orcamento_id).filter(Boolean)),
  ] as string[];
  const servicoIds = [...new Set((cs ?? []).map((x) => x.servico_id))];
  const [{ data: itens }, { data: servicos }] = await Promise.all([
    itemIds.length
      ? supabase.from("item_orcamento").select("id,valor_total").in("id", itemIds)
      : Promise.resolve({ data: [] as { id: string; valor_total: number }[] }),
    servicoIds.length
      ? supabase.from("servico").select("id,nome").in("id", servicoIds)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);
  const valorItem = new Map((itens ?? []).map((i) => [i.id, Number(i.valor_total)]));
  const nomeServico = new Map((servicos ?? []).map((s) => [s.id, s.nome]));

  const linhas: LinhaComissao[] = [];
  for (const c of cs ?? []) {
    const rate = ratePorServico.get(c.servico_id);
    if (!rate) continue; // sem taxa definida → sem comissão
    const baseCalc = c.item_orcamento_id ? valorItem.get(c.item_orcamento_id) ?? 0 : 0;
    const valor = calcularComissao(rate.tipo, rate.valor, baseCalc);
    if (valor <= 0) continue;
    const data = dataPorConsulta.get(c.consulta_id);
    linhas.push({
      consulta_servico_id: c.id,
      consulta_id: c.consulta_id,
      descricao: `${nomeServico.get(c.servico_id) ?? "Serviço"}${
        data ? ` · ${new Date(data).toLocaleDateString("pt-BR")}` : ""
      }`,
      base_calculo: baseCalc,
      tipo_comissao: rate.tipo,
      valor,
      ja_comissionado: jaComissionados.has(c.id),
    });
  }

  return { erro: null, base, linhas };
}

export async function apurarComissao(input: {
  profissional_id: string;
  competencia: string; // YYYY-MM
  vencimento: string; // YYYY-MM-DD
  categoria_id?: string | null;
  itens: {
    consulta_servico_id: string;
    consulta_id: string;
    base_calculo: number;
    tipo_comissao: TipoComissao;
    valor: number;
  }[];
}): Promise<EstadoComissao> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  const itens = (input.itens ?? []).filter((i) => Number(i.valor) > 0);
  if (itens.length === 0) return { erro: "Selecione ao menos uma comissão." };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("apurar_comissao", {
    p_clinica_id: sessao.clinicaAtual!,
    p_profissional_id: input.profissional_id,
    p_competencia: `${input.competencia}-01`,
    p_vencimento: input.vencimento,
    p_categoria_id: input.categoria_id ?? undefined,
    p_itens: itens.map((i) => ({
      consulta_servico_id: i.consulta_servico_id,
      consulta_id: i.consulta_id,
      base_calculo: i.base_calculo,
      tipo_comissao: i.tipo_comissao,
      valor: i.valor,
    })) as unknown as Json,
  });

  if (error) {
    return {
      erro:
        error.code === "23505"
          ? "Nada novo para apurar (competência já apurada?)."
          : error.code === "42501"
            ? "Sem permissão para apurar comissão."
            : error.code === "23514"
              ? "Profissional inválido para esta clínica."
              : "Não foi possível apurar a comissão.",
    };
  }

  revalidatePath("/painel/financeiro/comissoes");
  revalidatePath("/painel/financeiro/fluxo-caixa");
  return { erro: null, ok: true, id: data as string };
}

export async function cancelarApuracao(lancamentoId: string): Promise<EstadoComissao> {
  const { sessao, erro } = await exigirFinanceiro();
  if (!sessao) return { erro };
  const supabase = createClient();
  const { error } = await supabase.rpc("cancelar_apuracao_comissao", {
    p_clinica_id: sessao.clinicaAtual!,
    p_lancamento_id: lancamentoId,
  });
  if (error) {
    return {
      erro:
        error.code === "23514"
          ? "Não é possível cancelar (comissão já baixada?)."
          : "Não foi possível cancelar a apuração.",
    };
  }
  revalidatePath("/painel/financeiro/comissoes");
  return { erro: null, ok: true };
}
