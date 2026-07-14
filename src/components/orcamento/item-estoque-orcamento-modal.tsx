"use client";

// Porta de reference/base44 src/components/orcamento/ItemEstoqueOrcamentoModal.jsx.
// Adiciona um PRODUTO de estoque como linha do orçamento (servico_id nulo,
// item_estoque_id preenchido — delta S3-1 no item_orcamento).
import { useState } from "react";

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

import type { ItemFormulario, ProdutoEstoque } from "./tipos";

export function ItemEstoqueOrcamentoModal({
  open,
  onOpenChange,
  produtos,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produtos: ProdutoEstoque[];
  onAdd: (item: ItemFormulario) => void;
}) {
  const [itemId, setItemId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [valorUnit, setValorUnit] = useState(0);
  const [observacao, setObservacao] = useState("");

  const disponiveis = produtos.filter((p) => p.saldo > 0);

  function selecionar(id: string) {
    setItemId(id);
    const p = produtos.find((x) => x.id === id);
    if (p) setValorUnit(Number(p.preco_venda ?? p.preco_custo ?? 0));
  }

  function adicionar() {
    if (!itemId) return;
    const p = produtos.find((x) => x.id === itemId);
    onAdd({
      servico_id: null,
      item_estoque_id: itemId,
      nome: p?.descricao ?? "Produto",
      quantidade: Number(quantidade) || 1,
      valor_unitario: Number(valorUnit) || 0,
      tipo_valor: "fixo",
      regioes: [],
      unidade: p?.unidade ?? "un",
      observacao: observacao.trim() || null,
    });
    setItemId("");
    setQuantidade(1);
    setValorUnit(0);
    setObservacao("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar produto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Select value={itemId} onValueChange={selecionar}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {disponiveis.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.descricao} ({p.saldo} {p.unidade ?? "un"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {disponiveis.length === 0 && (
              <p className="text-muted-foreground text-xs">
                Nenhum produto com saldo disponível.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor unitário (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={valorUnit}
                onChange={(e) => setValorUnit(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={adicionar} disabled={!itemId}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
