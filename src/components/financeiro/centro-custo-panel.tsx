"use client";

// Porta de reference/base44 CentroCustoPanel/CentroCustoModal.
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  excluirCentroCusto,
  salvarCentroCusto,
  type CentroCustoInput,
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

import type { CentroCustoRow } from "./tipos";

const CORES = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#64748b", "#0ea5e9",
];

export function CentroCustoPanel({ centros }: { centros: CentroCustoRow[] }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<CentroCustoRow | null>(null);
  const [, startTransition] = useTransition();

  function excluir(id: string) {
    if (!confirm("Excluir centro de custo?")) return;
    startTransition(async () => {
      await excluirCentroCusto(id);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Centros de custo</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditando(null);
            setModal(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Novo
        </Button>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {centros.length === 0 && (
          <p className="text-muted-foreground p-3 text-sm">Nenhum centro de custo.</p>
        )}
        {centros.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 p-2.5">
            <span className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: c.cor ?? "#94a3b8" }}
              />
              {c.nome}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditando(c);
                  setModal(true);
                }}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => excluir(c.id)}
                className="text-destructive p-1 hover:opacity-70"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && <CentroModal open={modal} onOpenChange={setModal} centro={editando} />}
    </div>
  );
}

function CentroModal({
  open,
  onOpenChange,
  centro,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  centro: CentroCustoRow | null;
}) {
  const [form, setForm] = useState<CentroCustoInput>({
    id: centro?.id,
    nome: centro?.nome ?? "",
    descricao: centro?.descricao ?? "",
    cor: centro?.cor ?? CORES[0],
    ativo: centro?.ativo ?? true,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{centro ? "Editar" : "Novo"} centro de custo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-1.5">
              {CORES.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, cor }))}
                  className={`h-6 w-6 rounded-full border-2 ${
                    form.cor === cor ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: cor }}
                  aria-label={cor}
                />
              ))}
            </div>
          </div>
          {erro && <p className="text-destructive text-sm">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            disabled={salvando}
            onClick={() =>
              startTransition(async () => {
                setErro(null);
                const r = await salvarCentroCusto(form);
                if (r.erro) setErro(r.erro);
                else onOpenChange(false);
              })
            }
          >
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
