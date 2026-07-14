"use client";

// Porta de reference/base44 ContaDetalhe.jsx — extrato com saldo corrente,
// conciliação (toggle + CSV) e estorno de baixa. Nenhum INSERT de movimentacao
// aqui (a movimentação nasce na RPC de baixa); só o flag `conciliada` é editável.
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { conciliarMovimentacao, estornarBaixa } from "@/lib/actions/financeiro";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConciliacaoPanel } from "@/components/financeiro/conciliacao-panel";
import {
  formatarBRL,
  STATUS_LANCAMENTO,
  TIPO_CONTA_LABEL,
  type StatusLancamento,
  type TipoConta,
} from "@/components/financeiro/tipos";
import { valorAssinado } from "@/lib/conciliacao";

type Mov = {
  id: string;
  lancamento_id: string | null;
  tipo: "entrada" | "saida";
  descricao: string | null;
  valor: number;
  data: string;
  conciliada: boolean;
  observacao: string | null;
};
type Lanc = {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: number;
  valor_pago: number;
  data_vencimento: string;
  status: StatusLancamento;
  venda_id: string | null;
};

export function ContaDetalheClient({
  conta,
  movimentacoes,
  lancamentos,
  baixaPorMov,
}: {
  conta: { id: string; nome: string; tipo: TipoConta; saldo_inicial: number; saldo_atual: number };
  movimentacoes: Mov[];
  lancamentos: Lanc[];
  baixaPorMov: Record<string, string>;
}) {
  const [, startTransition] = useTransition();

  // saldo corrente (ordem cronológica)
  const linhas = useMemo(() => {
    let saldo = Number(conta.saldo_inicial);
    return movimentacoes.map((m) => {
      saldo += valorAssinado(m);
      return { mov: m, saldo };
    });
  }, [movimentacoes, conta.saldo_inicial]);

  function toggleConciliar(m: Mov) {
    startTransition(async () => {
      await conciliarMovimentacao(m.id, !m.conciliada);
    });
  }
  function estornar(baixaId: string) {
    if (!confirm("Estornar esta baixa? A movimentação será removida.")) return;
    startTransition(async () => {
      await estornarBaixa(baixaId);
    });
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Link
        href="/painel/financeiro/contas"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Contas
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{conta.nome}</h1>
          <p className="text-muted-foreground text-sm">{TIPO_CONTA_LABEL[conta.tipo]}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs">Saldo atual</p>
          <p className="text-2xl font-semibold">{formatarBRL(conta.saldo_atual)}</p>
        </div>
      </div>

      <Tabs defaultValue="extrato">
        <TabsList>
          <TabsTrigger value="extrato">Extrato &amp; Conciliação</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="extrato" className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-right">Saldo</th>
                  <th className="p-2 text-center">Conciliado</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground p-4 text-center">
                      Sem movimentações. As baixas de lançamentos aparecem aqui.
                    </td>
                  </tr>
                )}
                {linhas.map(({ mov, saldo }) => (
                  <tr key={mov.id} className="hover:bg-muted/30">
                    <td className="p-2">
                      {new Date(`${mov.data}T00:00:00`).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-2">{mov.descricao ?? "—"}</td>
                    <td
                      className={`p-2 text-right ${
                        mov.tipo === "entrada" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {mov.tipo === "entrada" ? "+" : "−"}
                      {formatarBRL(Number(mov.valor))}
                    </td>
                    <td className="p-2 text-right">{formatarBRL(saldo)}</td>
                    <td className="p-2 text-center">
                      <Switch
                        checked={mov.conciliada}
                        onCheckedChange={() => toggleConciliar(mov)}
                      />
                    </td>
                    <td className="p-2 text-right">
                      {baixaPorMov[mov.id] && (
                        <button
                          type="button"
                          onClick={() => estornar(baixaPorMov[mov.id])}
                          className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1 text-xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Estornar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ConciliacaoPanel
            movimentacoes={movimentacoes.map((m) => ({
              id: m.id,
              data: m.data,
              valor: Number(m.valor),
              tipo: m.tipo,
              conciliada: m.conciliada,
            }))}
          />
        </TabsContent>

        <TabsContent value="lancamentos">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-right">Pago</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lancamentos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted-foreground p-4 text-center">
                      Nenhum lançamento vinculado a esta conta.
                    </td>
                  </tr>
                )}
                {lancamentos.map((l) => {
                  const st = STATUS_LANCAMENTO[l.status];
                  return (
                    <tr key={l.id}>
                      <td className="p-2">
                        {l.descricao}
                        {l.venda_id && (
                          <span className="text-muted-foreground ml-1 text-xs">(venda)</span>
                        )}
                      </td>
                      <td className="p-2">{l.tipo === "receita" ? "A receber" : "A pagar"}</td>
                      <td className="p-2 text-right">{formatarBRL(Number(l.valor))}</td>
                      <td className="p-2 text-right">{formatarBRL(Number(l.valor_pago))}</td>
                      <td className="p-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${st.cor}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
