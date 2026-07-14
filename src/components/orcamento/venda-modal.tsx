"use client";

// Porta de reference/base44 src/components/orcamento/VendaModal.jsx.
// Fecha um orçamento aprovado em venda + parcelas. As parcelas iguais são
// pré-visualizadas aqui; o cálculo/atomicidade real é da RPC vender_orcamento.
import { useState, useTransition } from "react";

import { venderOrcamento, type FormaPagamento } from "@/lib/actions/vendas";
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

import { FORMAS_PAGAMENTO, formatarBRL, type OrcamentoRow } from "./tipos";

export function VendaModal({
  open,
  onOpenChange,
  orcamento,
  onSold,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orcamento: OrcamentoRow | null;
  onSold: () => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [parcelas, setParcelas] = useState(1);
  const [dataVenda, setDataVenda] = useState(hoje);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const valorFinal = orcamento?.valor_final ?? 0;
  const valorParcela = parcelas > 0 ? valorFinal / parcelas : valorFinal;

  function confirmar() {
    if (!orcamento) return;
    setErro(null);
    startTransition(async () => {
      const r = await venderOrcamento({
        orcamento_id: orcamento.id,
        forma_pagamento: forma,
        data_venda: dataVenda,
        parcelas,
      });
      if (r.erro) setErro(r.erro);
      else onSold();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fechar venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-muted-foreground text-xs">Total do orçamento</p>
            <p className="text-2xl font-semibold">{formatarBRL(valorFinal)}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Parcelas</Label>
              <Select
                value={String(parcelas)}
                onValueChange={(v) => setParcelas(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data da venda</Label>
              <Input
                type="date"
                value={dataVenda}
                onChange={(e) => setDataVenda(e.target.value)}
              />
            </div>
          </div>

          <p className="text-muted-foreground text-center text-sm">
            {parcelas}x de aproximadamente {formatarBRL(valorParcela)}
          </p>

          {erro && <p className="text-destructive text-sm">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvando || !orcamento}>
            {salvando ? "Vendendo..." : "Confirmar venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
