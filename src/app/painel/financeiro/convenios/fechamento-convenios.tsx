"use client";

// S4-5 — Fechamento de guia por convênio. Fluxo: (1) gerar recebíveis do
// período; (2) subir o CSV que a operadora devolveu; (3) conciliar por número
// de guia; (4) dar baixa em lote (RPC transacional). Toda a aritmética de
// conciliação é pura (src/lib/convenio-csv.ts); a UI só orquestra.
import { useMemo, useState, useTransition } from "react";
import { FileSpreadsheet, Upload, Wallet, RefreshCw } from "lucide-react";

import {
  atendimentosParaFechamento,
  gerarRecebiveisConvenio,
  registrarBaixaLoteConvenio,
  type AtendimentoFechamento,
} from "@/lib/actions/convenios";
import {
  conciliarGuias,
  itensParaBaixa,
  parseCsvGuias,
  type GuiaConciliada,
  type SituacaoGuia,
} from "@/lib/convenio-csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const SITUACAO: Record<SituacaoGuia, { label: string; cls: string }> = {
  paga: { label: "Paga", cls: "bg-emerald-100 text-emerald-700" },
  divergente: { label: "Divergente", cls: "bg-amber-100 text-amber-700" },
  glosada: { label: "Glosada", cls: "bg-red-100 text-red-700" },
  sem_retorno: { label: "Sem retorno", cls: "bg-slate-100 text-slate-600" },
  nao_reconhecida: { label: "Não reconhecida", cls: "bg-red-100 text-red-700" },
};

function primeiroDiaMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FechamentoConvenios({
  convenios,
  contas,
  podeGerenciar,
}: {
  convenios: { id: string; nome: string }[];
  contas: { id: string; nome: string }[];
  podeGerenciar: boolean;
}) {
  const [convenioId, setConvenioId] = useState("");
  const [ini, setIni] = useState(primeiroDiaMes());
  const [fim, setFim] = useState(hojeISO());
  const [atendimentos, setAtendimentos] = useState<AtendimentoFechamento[]>([]);
  const [conciliadas, setConciliadas] = useState<GuiaConciliada[] | null>(null);
  const [contaId, setContaId] = useState("");
  const [forma, setForma] = useState<"convenio" | "transferencia" | "pix">("convenio");
  const [dataBaixa, setDataBaixa] = useState(hojeISO());
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, startTransition] = useTransition();

  const itensBaixa = useMemo(
    () => (conciliadas ? itensParaBaixa(conciliadas) : []),
    [conciliadas]
  );
  const totalBaixa = itensBaixa.reduce((a, i) => a + i.valor, 0);

  async function carregar(convId: string) {
    setConciliadas(null);
    const r = await atendimentosParaFechamento(convId);
    if (r.erro) {
      setErro(r.erro);
      setAtendimentos([]);
    } else {
      setErro(null);
      setAtendimentos(r.atendimentos);
    }
  }

  function selecionarConvenio(id: string) {
    setConvenioId(id);
    setMsg(null);
    startTransition(() => void carregar(id));
  }

  function gerar() {
    setErro(null);
    setMsg(null);
    startTransition(async () => {
      const r = await gerarRecebiveisConvenio({ convenio_id: convenioId, ini, fim });
      if (r.erro) return setErro(r.erro);
      setMsg(
        r.criados === 0
          ? "Nenhuma guia nova (já geradas ou sem valor)."
          : `${r.criados} guia(s) gerada(s) — ${brl(r.total ?? 0)}.`
      );
      await carregar(convenioId);
    });
  }

  async function aoSubirCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-subir o mesmo arquivo
    if (!file) return;
    setErro(null);
    setMsg(null);
    const texto = await file.text();
    const linhas = parseCsvGuias(texto);
    if (linhas.length === 0) {
      setErro("CSV sem linhas de guia reconhecíveis.");
      return;
    }
    const conc = conciliarGuias(
      atendimentos.map((a) => ({
        lancamento_id: a.lancamento_id,
        numero_guia: a.numero_guia,
        valor_devido: a.valor_devido,
      })),
      linhas
    );
    setConciliadas(conc);
  }

  function baixar() {
    setErro(null);
    setMsg(null);
    startTransition(async () => {
      const r = await registrarBaixaLoteConvenio({
        conta_id: contaId,
        forma,
        data: dataBaixa,
        itens: itensBaixa,
      });
      if (r.erro) return setErro(r.erro);
      setMsg(`${r.baixados} guia(s) baixada(s) — ${brl(r.total ?? 0)}.`);
      setConciliadas(null);
      await carregar(convenioId);
    });
  }

  const totalDevido = atendimentos.reduce((a, x) => a + x.valor_devido, 0);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Fechamento de guias</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gere os recebíveis do período, concilie com o CSV da operadora e dê
          baixa em lote.
        </p>
      </div>

      {!podeGerenciar ? (
        <p className="text-sm text-muted-foreground">
          Apenas proprietário/gerente acessam o fechamento financeiro.
        </p>
      ) : (
        <>
          {/* Passo 1 — período + gerar recebíveis */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Convênio</Label>
                <Select value={convenioId} onValueChange={selecionarConvenio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar convênio" />
                  </SelectTrigger>
                  <SelectContent>
                    {convenios.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>De</Label>
                <Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Até</Label>
                <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
            </div>
            <Button
              onClick={gerar}
              disabled={!convenioId || carregando}
              className="gap-1.5"
            >
              <RefreshCw className="w-4 h-4" /> Gerar recebíveis do período
            </Button>
          </div>

          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
          {erro && <p className="text-sm text-destructive">{erro}</p>}

          {/* Passo 2 — guias em aberto + upload CSV */}
          {convenioId && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-semibold text-sm">
                    Guias em aberto ({atendimentos.length})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Total devido: {brl(totalDevido)}
                  </p>
                </div>
                <label className="inline-flex items-center gap-1.5 text-sm font-medium cursor-pointer px-3 py-2 rounded-lg border border-border hover:bg-muted">
                  <Upload className="w-4 h-4" /> Subir CSV da operadora
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="hidden"
                    onChange={aoSubirCsv}
                  />
                </label>
              </div>

              {atendimentos.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    Nenhuma guia em aberto. Gere os recebíveis do período acima.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3 font-medium">Guia</th>
                        <th className="py-2 pr-3 font-medium">Paciente</th>
                        <th className="py-2 pr-3 font-medium text-right">Devido</th>
                        {conciliadas && (
                          <>
                            <th className="py-2 pr-3 font-medium text-right">Pago (CSV)</th>
                            <th className="py-2 font-medium">Situação</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(conciliadas ?? atendimentos.map(paraConciliadaVazia)).map((g, i) => (
                        <tr key={`${g.numero_guia}-${i}`} className="border-b border-border/50">
                          <td className="py-2 pr-3 font-mono text-xs">
                            {g.numero_guia || "s/nº"}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {nomeDoAtendimento(atendimentos, g.lancamento_id)}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {g.valor_devido != null ? brl(g.valor_devido) : "—"}
                          </td>
                          {conciliadas && (
                            <>
                              <td className="py-2 pr-3 text-right">{brl(g.valor_pago)}</td>
                              <td className="py-2">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${SITUACAO[g.situacao].cls}`}
                                >
                                  {SITUACAO[g.situacao].label}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Passo 3 — baixa em lote */}
          {conciliadas && itensBaixa.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">
                  Registrar baixa — {itensBaixa.length} guia(s), {brl(totalBaixa)}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>Conta de recebimento</Label>
                  <Select value={contaId} onValueChange={setContaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {contas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Forma</Label>
                  <Select
                    value={forma}
                    onValueChange={(v) => setForma(v as typeof forma)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="convenio">Convênio</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={dataBaixa}
                    onChange={(e) => setDataBaixa(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={baixar} disabled={!contaId || carregando} className="gap-1.5">
                <Wallet className="w-4 h-4" /> Confirmar baixa em lote
              </Button>
              <p className="text-xs text-muted-foreground">
                Glosadas e sem retorno permanecem em aberto. Divergentes baixam o
                valor efetivamente pago (o restante segue como saldo).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Linha "antes do CSV": mostra a guia devida sem colunas de conciliação.
function paraConciliadaVazia(a: AtendimentoFechamento): GuiaConciliada {
  return {
    numero_guia: a.numero_guia ?? "",
    lancamento_id: a.lancamento_id,
    valor_devido: a.valor_devido,
    valor_pago: 0,
    situacao: "sem_retorno",
  };
}

function nomeDoAtendimento(
  atendimentos: AtendimentoFechamento[],
  lancamentoId: string | null
): string {
  if (!lancamentoId) return "—";
  return atendimentos.find((a) => a.lancamento_id === lancamentoId)?.paciente_nome ?? "—";
}
