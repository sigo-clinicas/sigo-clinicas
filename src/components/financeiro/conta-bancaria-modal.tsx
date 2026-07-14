"use client";

// Porta de reference/base44 src/components/financeiro/ContaBancariaModal.jsx.
import { useState, useTransition } from "react";

import { salvarConta, type ContaBancariaInput } from "@/lib/actions/financeiro";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { TIPO_CONTA_LABEL, type ContaRow, type TipoConta } from "./tipos";

export function ContaBancariaModal({
  open,
  onOpenChange,
  conta,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conta: ContaRow | null;
}) {
  const [form, setForm] = useState<ContaBancariaInput>({
    id: conta?.id,
    nome: conta?.nome ?? "",
    tipo: conta?.tipo ?? "conta_corrente",
    banco: conta?.banco ?? "",
    agencia: conta?.agencia ?? "",
    numero_conta: conta?.numero_conta ?? "",
    saldo_inicial: conta?.saldo_inicial ?? 0,
    ativo: conta?.ativo ?? true,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function set<K extends keyof ContaBancariaInput>(k: K, v: ContaBancariaInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{conta ? "Editar conta" : "Nova conta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v as TipoConta)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_CONTA_LABEL) as TipoConta[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_CONTA_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Input value={form.banco ?? ""} onChange={(e) => set("banco", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Agência</Label>
              <Input value={form.agencia ?? ""} onChange={(e) => set("agencia", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Input
                value={form.numero_conta ?? ""}
                onChange={(e) => set("numero_conta", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Saldo inicial (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.saldo_inicial}
              onChange={(e) => set("saldo_inicial", Number(e.target.value))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativa</Label>
            <Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} />
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
                const r = await salvarConta(form);
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
