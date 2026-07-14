"use client";

// Porta de reference/base44 CategoriasLista/CategoriaModal — categorias por
// tipo (receita/despesa) com subcategorias (pai_id). Reorder por `ordem`
// fica como follow-up; aqui CRUD + hierarquia de 1 nível.
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  excluirCategoria,
  salvarCategoria,
  type CategoriaInput,
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

import type { CategoriaRow, TipoLancamento } from "./tipos";

const RAIZ = "__raiz__";

export function CategoriasLista({
  tipo,
  categorias,
}: {
  tipo: TipoLancamento;
  categorias: CategoriaRow[];
}) {
  const doTipo = categorias.filter((c) => c.tipo === tipo);
  const raizes = doTipo.filter((c) => !c.pai_id);
  const filhosDe = (id: string) => doTipo.filter((c) => c.pai_id === id);

  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<CategoriaRow | null>(null);
  const [, startTransition] = useTransition();

  function abrirNova() {
    setEditando(null);
    setModal(true);
  }
  function abrirEdicao(c: CategoriaRow) {
    setEditando(c);
    setModal(true);
  }
  function excluir(id: string) {
    if (!confirm("Excluir categoria?")) return;
    startTransition(async () => {
      await excluirCategoria(id);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize">{tipo}s</h3>
        <Button size="sm" variant="outline" onClick={abrirNova}>
          <Plus className="mr-1 h-4 w-4" /> Nova
        </Button>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {raizes.length === 0 && (
          <p className="text-muted-foreground p-3 text-sm">Nenhuma categoria.</p>
        )}
        {raizes.map((c) => (
          <div key={c.id}>
            <Linha categoria={c} onEditar={abrirEdicao} onExcluir={excluir} />
            {filhosDe(c.id).map((f) => (
              <div key={f.id} className="pl-6">
                <Linha categoria={f} onEditar={abrirEdicao} onExcluir={excluir} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {modal && (
        <CategoriaModal
          open={modal}
          onOpenChange={setModal}
          tipo={tipo}
          categoria={editando}
          raizes={raizes}
        />
      )}
    </div>
  );
}

function Linha({
  categoria,
  onEditar,
  onExcluir,
}: {
  categoria: CategoriaRow;
  onEditar: (c: CategoriaRow) => void;
  onExcluir: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-2.5">
      <span className={`text-sm ${categoria.ativo ? "" : "text-muted-foreground line-through"}`}>
        {categoria.nome}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onEditar(categoria)}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onExcluir(categoria.id)}
          className="text-destructive p-1 hover:opacity-70"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CategoriaModal({
  open,
  onOpenChange,
  tipo,
  categoria,
  raizes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: TipoLancamento;
  categoria: CategoriaRow | null;
  raizes: CategoriaRow[];
}) {
  const [form, setForm] = useState<CategoriaInput>({
    id: categoria?.id,
    nome: categoria?.nome ?? "",
    tipo,
    descricao: categoria?.descricao ?? "",
    pai_id: categoria?.pai_id ?? null,
    ordem: categoria?.ordem ?? 0,
    ativo: categoria?.ativo ?? true,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar" : "Nova"} categoria</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria pai (opcional)</Label>
            <Select
              value={form.pai_id ?? RAIZ}
              onValueChange={(v) => setForm((f) => ({ ...f, pai_id: v === RAIZ ? null : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma (raiz)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={RAIZ}>Nenhuma (raiz)</SelectItem>
                {raizes
                  .filter((r) => r.id !== categoria?.id)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
                const r = await salvarCategoria(form);
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
