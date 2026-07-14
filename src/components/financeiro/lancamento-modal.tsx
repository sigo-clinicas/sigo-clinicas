"use client";

// Porta de reference/base44 src/components/financeiro/LancamentoModal.jsx.
// Cadastro do lançamento (contas a pagar/receber). A BAIXA/recebimento é
// separada (baixa-modal → RPC). Lançamento gerado por venda é read-only.
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import {
  excluirLancamento,
  salvarLancamento,
  type LancamentoInput,
} from "@/lib/actions/financeiro";
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
  type CategoriaRow,
  type CentroCustoRow,
  type LancamentoRow,
  type TipoLancamento,
} from "./tipos";

const SEM = "__sem__";

export function LancamentoModal({
  open,
  onOpenChange,
  lancamento,
  tipoFixo,
  categorias,
  centros,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lancamento: LancamentoRow | null;
  tipoFixo?: TipoLancamento;
  categorias: CategoriaRow[];
  centros: CentroCustoRow[];
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<LancamentoInput>({
    id: lancamento?.id,
    tipo: lancamento?.tipo ?? tipoFixo ?? "receita",
    descricao: lancamento?.descricao ?? "",
    valor: lancamento?.valor ?? 0,
    data_vencimento: lancamento?.data_vencimento ?? hoje,
    categoria_id: lancamento?.categoria_id ?? null,
    centro_custo_id: lancamento?.centro_custo_id ?? null,
    forma_pagamento: (lancamento?.forma_pagamento as LancamentoInput["forma_pagamento"]) ?? null,
    observacoes: lancamento?.observacoes ?? null,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();
  const readOnly = !!lancamento?.venda_id;

  function set<K extends keyof LancamentoInput>(k: K, v: LancamentoInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const categoriasDoTipo = categorias.filter((c) => c.tipo === form.tipo && c.ativo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {lancamento ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
        </DialogHeader>

        {readOnly ? (
          <p className="text-muted-foreground text-sm">
            Lançamento gerado por venda — somente leitura. Gerencie pelo funil
            comercial e pela baixa financeira.
          </p>
        ) : (
          <div className="space-y-3">
            {!tipoFixo && (
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v as TipoLancamento)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">A receber (receita)</SelectItem>
                    <SelectItem value="despesa">A pagar (despesa)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.valor}
                  onChange={(e) => set("valor", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={form.data_vencimento}
                  onChange={(e) => set("data_vencimento", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={form.categoria_id ?? SEM}
                  onValueChange={(v) => set("categoria_id", v === SEM ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM}>—</SelectItem>
                    {categoriasDoTipo.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Centro de custo</Label>
                <Select
                  value={form.centro_custo_id ?? SEM}
                  onValueChange={(v) => set("centro_custo_id", v === SEM ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM}>—</SelectItem>
                    {centros
                      .filter((c) => c.ativo)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input
                value={form.observacoes ?? ""}
                onChange={(e) => set("observacoes", e.target.value)}
              />
            </div>
            {erro && <p className="text-destructive text-sm">{erro}</p>}
          </div>
        )}

        <DialogFooter className="justify-between">
          {lancamento && !readOnly ? (
            <Button
              variant="outline"
              className="text-destructive"
              disabled={salvando}
              onClick={() =>
                startTransition(async () => {
                  const r = await excluirLancamento(lancamento.id);
                  if (r.erro) setErro(r.erro);
                  else onOpenChange(false);
                })
              }
            >
              <Trash2 className="mr-1 h-4 w-4" /> Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
              Fechar
            </Button>
            {!readOnly && (
              <Button
                disabled={salvando}
                onClick={() =>
                  startTransition(async () => {
                    setErro(null);
                    const r = await salvarLancamento(form);
                    if (r.erro) setErro(r.erro);
                    else onOpenChange(false);
                  })
                }
              >
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
