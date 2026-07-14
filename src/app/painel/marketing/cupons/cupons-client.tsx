"use client";

// S3-6 — CRUD de cupons. Porta conceitual do cupom do Base44 (LandingPage),
// agora sobre a tabela public.cupom (por clínica).
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { excluirCupom, salvarCupom, type CupomInput } from "@/lib/actions/marketing";
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

type CupomRow = {
  id: string;
  codigo: string;
  tipo_desconto: "percentual" | "valor";
  valor_desconto: number;
  descricao: string | null;
  status: "pendente" | "ativo" | "aceito" | "expirado" | "cancelado";
  validade_inicio: string | null;
  validade_fim: string | null;
  regras_uso: string | null;
  quantidade_usos: number;
};

const STATUS: Record<CupomRow["status"], { label: string; cor: string }> = {
  pendente: { label: "Pendente", cor: "bg-gray-100 text-gray-700" },
  ativo: { label: "Ativo", cor: "bg-green-100 text-green-700" },
  aceito: { label: "Aceito", cor: "bg-blue-100 text-blue-700" },
  expirado: { label: "Expirado", cor: "bg-amber-100 text-amber-700" },
  cancelado: { label: "Cancelado", cor: "bg-red-100 text-red-700" },
};

export function CuponsClient({ cupons }: { cupons: CupomRow[] }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<CupomRow | null>(null);
  const [, startTransition] = useTransition();

  function excluir(id: string) {
    if (!confirm("Excluir cupom?")) return;
    startTransition(async () => {
      await excluirCupom(id);
    });
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cupons</h1>
        <Button
          onClick={() => {
            setEditando(null);
            setModal(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Novo cupom
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="p-2 text-left">Código</th>
              <th className="p-2 text-left">Desconto</th>
              <th className="p-2 text-left">Validade</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cupons.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground p-4 text-center">
                  Nenhum cupom. Cupons ativos aparecem no marketplace.
                </td>
              </tr>
            )}
            {cupons.map((c) => (
              <tr key={c.id}>
                <td className="p-2 font-mono font-medium">{c.codigo}</td>
                <td className="p-2">
                  {c.tipo_desconto === "percentual"
                    ? `${c.valor_desconto}%`
                    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        Number(c.valor_desconto)
                      )}
                </td>
                <td className="p-2">
                  {c.validade_fim
                    ? `até ${new Date(`${c.validade_fim}T00:00:00`).toLocaleDateString("pt-BR")}`
                    : "—"}
                </td>
                <td className="p-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[c.status].cor}`}>
                    {STATUS[c.status].label}
                  </span>
                </td>
                <td className="p-2 text-right">
                  <div className="flex justify-end gap-1">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <CupomModal open={modal} onOpenChange={setModal} cupom={editando} />}
    </div>
  );
}

function CupomModal({
  open,
  onOpenChange,
  cupom,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cupom: CupomRow | null;
}) {
  const [form, setForm] = useState<CupomInput>({
    id: cupom?.id,
    codigo: cupom?.codigo ?? "",
    tipo_desconto: cupom?.tipo_desconto ?? "percentual",
    valor_desconto: cupom?.valor_desconto ?? 0,
    descricao: cupom?.descricao ?? "",
    status: cupom?.status ?? "ativo",
    validade_inicio: cupom?.validade_inicio ?? null,
    validade_fim: cupom?.validade_fim ?? null,
    regras_uso: cupom?.regras_uso ?? "",
    quantidade_usos: cupom?.quantidade_usos ?? 1,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function set<K extends keyof CupomInput>(k: K, v: CupomInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{cupom ? "Editar" : "Novo"} cupom</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Código</Label>
            <Input value={form.codigo} onChange={(e) => set("codigo", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.tipo_desconto}
                onValueChange={(v) => set("tipo_desconto", v as "percentual" | "valor")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="valor">Valor (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Desconto</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.valor_desconto}
                onChange={(e) => set("valor_desconto", Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as CupomInput["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["pendente", "ativo", "aceito", "expirado", "cancelado"] as const).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Qtd. usos</Label>
              <Input
                type="number"
                min={1}
                value={form.quantidade_usos}
                onChange={(e) => set("quantidade_usos", Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Válido de</Label>
              <Input
                type="date"
                value={form.validade_inicio ?? ""}
                onChange={(e) => set("validade_inicio", e.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Válido até</Label>
              <Input
                type="date"
                value={form.validade_fim ?? ""}
                onChange={(e) => set("validade_fim", e.target.value || null)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={form.descricao ?? ""}
              onChange={(e) => set("descricao", e.target.value)}
            />
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
                const r = await salvarCupom(form);
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
