"use client";

// Porta de reference/base44 ContaDetalhe (aba Conciliação) — upload/colagem de
// extrato CSV, auto-match por valor±0,02 / data±3d, e confirmação que grava
// movimentacao_conta.conciliada (via conciliarMovimentacao). Sem campos-fantasma.
import { useState, useTransition } from "react";
import { Upload } from "lucide-react";

import { conciliarMovimentacao } from "@/lib/actions/financeiro";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  autoMatch,
  parseExtratoCSV,
  type LinhaExtrato,
  type MovSimples,
} from "@/lib/conciliacao";
import { formatarBRL } from "./tipos";

export function ConciliacaoPanel({ movimentacoes }: { movimentacoes: MovSimples[] }) {
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<LinhaExtrato[] | null>(null);
  const [matches, setMatches] = useState<Map<number, string>>(new Map());
  const [salvando, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function analisar() {
    const parsed = parseExtratoCSV(texto);
    setLinhas(parsed);
    setMatches(autoMatch(parsed, movimentacoes));
    setMsg(null);
  }

  async function lerArquivo(file: File) {
    const conteudo = await file.text();
    setTexto(conteudo);
    const parsed = parseExtratoCSV(conteudo);
    setLinhas(parsed);
    setMatches(autoMatch(parsed, movimentacoes));
  }

  function confirmar() {
    const ids = [...new Set(matches.values())];
    if (ids.length === 0) return;
    startTransition(async () => {
      for (const id of ids) await conciliarMovimentacao(id, true);
      setMsg(`${ids.length} movimentação(ões) conciliada(s).`);
      setLinhas(null);
      setMatches(new Map());
      setTexto("");
    });
  }

  const casados = matches.size;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Conciliar extrato (CSV)</h3>
        <label className="text-primary inline-flex cursor-pointer items-center gap-1 text-xs hover:underline">
          <Upload className="h-3.5 w-3.5" /> Carregar arquivo
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void lerArquivo(f);
            }}
          />
        </label>
      </div>

      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">
          Cole o extrato no formato <code>Data;Descrição;Valor</code> (positivo = crédito)
        </Label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          className="border-border bg-background w-full rounded-md border p-2 font-mono text-xs"
          placeholder="14/07/2026;PIX recebido;100,00"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={analisar} disabled={!texto.trim()}>
          Analisar
        </Button>
        {linhas && (
          <span className="text-muted-foreground text-xs">
            {linhas.length} linha(s) · {casados} com par
          </span>
        )}
      </div>

      {linhas && linhas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground uppercase">
              <tr>
                <th className="p-1 text-left">Data</th>
                <th className="p-1 text-left">Descrição (extrato)</th>
                <th className="p-1 text-right">Valor</th>
                <th className="p-1 text-left">Match</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhas.map((l, i) => (
                <tr key={i}>
                  <td className="p-1">
                    {new Date(`${l.data}T00:00:00`).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-1">{l.descricao}</td>
                  <td className="p-1 text-right">{formatarBRL(l.valor)}</td>
                  <td className="p-1">
                    {matches.has(i) ? (
                      <span className="text-green-600">✓ conciliar</span>
                    ) : (
                      <span className="text-muted-foreground">sem par</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {casados > 0 && (
        <Button size="sm" onClick={confirmar} disabled={salvando}>
          {salvando ? "Conciliando..." : `Confirmar ${casados} conciliação(ões)`}
        </Button>
      )}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
    </div>
  );
}
