"use client";

// Porta de reference/base44 FecharContaModal/PagamentoRapidoModal — mas a
// baixa agora EXIGE conta bancária e nasce via RPC transacional (gera a
// movimentacao_conta atomicamente; corrige A6).
import { useState, useTransition } from "react";

import { registrarBaixa } from "@/lib/actions/financeiro";
import type { FormaPagamento } from "@/lib/actions/vendas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  emAberto,
  FORMAS_PAGAMENTO,
  formatarBRL,
  type ContaRow,
  type LancamentoRow,
} from "./tipos";

export function BaixaModal({
  open,
  onOpenChange,
  lancamento,
  contas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lancamento: LancamentoRow | null;
  contas: ContaRow[];
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const restante = lancamento ? emAberto(lancamento) : 0;
  const [contaId, setContaId] = useState(contas[0]?.id ?? "");
  const [valor, setValor] = useState(restante);
  const [data, setData] = useState(hoje);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const receber = lancamento?.tipo === "receita";

  function confirmar() {
    if (!lancamento) return;
    setErro(null);
    startTransition(async () => {
      const r = await registrarBaixa({
        lancamento_id: lancamento.id,
        conta_id: contaId,
        valor: Number(valor),
        data,
        forma,
        observacao: obs || null,
      });
      if (r.erro) setErro(r.erro);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{receber ? "Receber" : "Pagar"} lançamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            {lancamento?.descricao} · em aberto{" "}
            <span className="font-semibold">{formatarBRL(restante)}</span>
          </p>
          <div className="space-y-1.5">
            <Label>Conta bancária</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {contas
                  .filter((c) => c.ativo)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={restante}
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Forma</Label>
            <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((f) => (
                  <SelectItem key={f.valor} value={f.valor}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
          </div>
          {erro && <p className="text-destructive text-sm">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvando || !contaId || Number(valor) <= 0}>
            {salvando ? "Processando..." : receber ? "Receber" : "Pagar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
