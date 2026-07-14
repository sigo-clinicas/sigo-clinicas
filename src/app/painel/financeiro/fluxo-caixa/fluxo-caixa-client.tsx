"use client";

// Porta de reference/base44 FluxoCaixa.jsx — lista de lançamentos + KPIs +
// botão Receber/Pagar (baixa via RPC). Gráfico mensal (recharts) = follow-up.
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BaixaModal } from "@/components/financeiro/baixa-modal";
import { LancamentoModal } from "@/components/financeiro/lancamento-modal";
import {
  emAberto,
  formatarBRL,
  STATUS_LANCAMENTO,
  type CategoriaRow,
  type CentroCustoRow,
  type ContaRow,
  type LancamentoRow,
} from "@/components/financeiro/tipos";

export function FluxoCaixaClient({
  lancamentos,
  contas,
  categorias,
  centros,
}: {
  lancamentos: LancamentoRow[];
  contas: ContaRow[];
  categorias: CategoriaRow[];
  centros: CentroCustoRow[];
}) {
  const [aba, setAba] = useState<"todos" | "receita" | "despesa">("todos");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | "aberto" | "pago">("todos");
  const [busca, setBusca] = useState("");
  const [modalLanc, setModalLanc] = useState(false);
  const [editando, setEditando] = useState<LancamentoRow | null>(null);
  const [baixando, setBaixando] = useState<LancamentoRow | null>(null);

  const kpis = useMemo(() => {
    let recebido = 0, pago = 0, aReceber = 0, aPagar = 0;
    for (const l of lancamentos) {
      if (l.status === "cancelado") continue;
      const aberto = emAberto(l);
      if (l.tipo === "receita") {
        recebido += Number(l.valor_pago);
        aReceber += aberto;
      } else {
        pago += Number(l.valor_pago);
        aPagar += aberto;
      }
    }
    return { recebido, pago, saldo: recebido - pago, aReceber, aPagar };
  }, [lancamentos]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (aba !== "todos" && l.tipo !== aba) return false;
      if (statusFiltro === "aberto" && (l.status === "pago" || l.status === "cancelado"))
        return false;
      if (statusFiltro === "pago" && l.status !== "pago") return false;
      if (q && !l.descricao.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lancamentos, aba, statusFiltro, busca]);

  function novo() {
    setEditando(null);
    setModalLanc(true);
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Fluxo de caixa</h1>
        <Button onClick={novo}>
          <Plus className="mr-1 h-4 w-4" /> Novo lançamento
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Recebido", valor: kpis.recebido, cor: "text-green-600" },
          { label: "Pago", valor: kpis.pago, cor: "text-red-600" },
          { label: "Saldo", valor: kpis.saldo, cor: "" },
          { label: "A receber", valor: kpis.aReceber, cor: "text-green-600" },
          { label: "A pagar", valor: kpis.aPagar, cor: "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-muted-foreground text-xs">{k.label}</p>
            <p className={`text-lg font-semibold ${k.cor}`}>{formatarBRL(k.valor)}</p>
          </div>
        ))}
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="receita">A receber</TabsTrigger>
          <TabsTrigger value="despesa">A pagar</TabsTrigger>
        </TabsList>

        <TabsContent value={aba} className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
              <Input
                className="pl-8"
                placeholder="Buscar descrição"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as typeof statusFiltro)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aberto">Em aberto</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-right">Em aberto</th>
                  <th className="p-2 text-left">Vencimento</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground p-4 text-center">
                      Nenhum lançamento.
                    </td>
                  </tr>
                )}
                {lista.map((l) => {
                  const aberto = emAberto(l);
                  const st = STATUS_LANCAMENTO[l.status];
                  return (
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="p-2">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => {
                            setEditando(l);
                            setModalLanc(true);
                          }}
                        >
                          {l.descricao}
                          {l.venda_id && (
                            <span className="text-muted-foreground ml-1 text-xs">(venda)</span>
                          )}
                        </button>
                      </td>
                      <td className="p-2 text-right">{formatarBRL(Number(l.valor))}</td>
                      <td className="p-2 text-right">{formatarBRL(aberto)}</td>
                      <td className="p-2">
                        {new Date(`${l.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${st.cor}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        {aberto > 0 && l.status !== "cancelado" && (
                          <Button size="sm" variant="outline" onClick={() => setBaixando(l)}>
                            {l.tipo === "receita" ? "Receber" : "Pagar"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {modalLanc && (
        <LancamentoModal
          open={modalLanc}
          onOpenChange={setModalLanc}
          lancamento={editando}
          categorias={categorias}
          centros={centros}
        />
      )}
      {baixando && (
        <BaixaModal
          open={!!baixando}
          onOpenChange={(v) => !v && setBaixando(null)}
          lancamento={baixando}
          contas={contas}
        />
      )}
    </div>
  );
}
