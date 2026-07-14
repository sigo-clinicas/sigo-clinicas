"use client";

// Porta de reference/base44 admin/SalaVIP.jsx — Tabs Salas/Leads; CRUD de sala,
// aprovar/rejeitar; gestão dos interessados (lead_sala_vip).
import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import {
  atualizarStatusLeadVip,
  atualizarStatusSalaVip,
  excluirLeadVip,
  excluirSalaVip,
  salvarSalaVip,
  type SalaVipInput,
} from "@/lib/actions/marketing";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Sala = {
  id: string;
  nome: string;
  descricao: string | null;
  beneficios: string | null;
  quantidade_vagas: number;
  status: "pendente" | "aprovada" | "rejeitada";
  ativa: boolean;
  created_at: string;
};
type Lead = {
  id: string;
  sala_vip_id: string;
  nome: string;
  telefone: string;
  email: string | null;
  status: "novo" | "contatado" | "aprovado" | "recusado";
  data_interesse: string;
};

const STATUS_SALA: Record<Sala["status"], string> = {
  pendente: "bg-amber-100 text-amber-700",
  aprovada: "bg-green-100 text-green-700",
  rejeitada: "bg-red-100 text-red-700",
};

export function SalaVipClient({ salas, leads }: { salas: Sala[]; leads: Lead[] }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Sala | null>(null);
  const [, startTransition] = useTransition();
  const nomeSala = new Map(salas.map((s) => [s.id, s.nome]));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Sala VIP</h1>
      <Tabs defaultValue="salas">
        <TabsList>
          <TabsTrigger value="salas">Salas ({salas.length})</TabsTrigger>
          <TabsTrigger value="leads">Interessados ({leads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="salas" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditando(null); setModal(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Nova sala
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {salas.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma sala VIP.</p>}
            {salas.map((s) => (
              <div key={s.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{s.nome}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_SALA[s.status]}`}>
                      {s.status}{s.ativa ? " · ativa" : ""}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => { setEditando(s); setModal(true); }} className="text-muted-foreground hover:text-foreground p-1">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => { if (confirm("Excluir sala?")) startTransition(() => { void excluirSalaVip(s.id); }); }} className="text-destructive p-1 hover:opacity-70">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {s.descricao && <p className="text-muted-foreground mt-2 text-sm">{s.descricao}</p>}
                <p className="text-muted-foreground mt-1 text-xs">{s.quantidade_vagas} vagas</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startTransition(() => { void atualizarStatusSalaVip(s.id, "aprovada"); })}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startTransition(() => { void atualizarStatusSalaVip(s.id, "rejeitada"); })}>
                    <X className="mr-1 h-3.5 w-3.5" /> Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="leads" className="space-y-2">
          {leads.length === 0 && (
            <p className="text-muted-foreground rounded-lg border border-dashed border-border p-6 text-center text-sm">
              Nenhum interessado ainda.
            </p>
          )}
          {leads.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium">{l.nome}</p>
                <p className="text-muted-foreground text-xs">
                  {l.telefone}{l.email ? ` · ${l.email}` : ""} · {nomeSala.get(l.sala_vip_id) ?? "sala"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={l.status} onValueChange={(v) => startTransition(() => { void atualizarStatusLeadVip(l.id, v as Lead["status"]); })}>
                  <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["novo", "contatado", "aprovado", "recusado"] as const).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button type="button" onClick={() => { if (confirm("Excluir interessado?")) startTransition(() => { void excluirLeadVip(l.id); }); }} className="text-destructive p-1 hover:opacity-70">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {modal && <SalaModal open={modal} onOpenChange={setModal} sala={editando} />}
    </div>
  );
}

function SalaModal({
  open,
  onOpenChange,
  sala,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sala: Sala | null;
}) {
  const [form, setForm] = useState<SalaVipInput>({
    id: sala?.id,
    nome: sala?.nome ?? "",
    descricao: sala?.descricao ?? "",
    beneficios: sala?.beneficios ?? "",
    quantidade_vagas: sala?.quantidade_vagas ?? 100,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{sala ? "Editar" : "Nova"} sala VIP</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={form.descricao ?? ""} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Benefícios</Label>
            <Input value={form.beneficios ?? ""} onChange={(e) => setForm((f) => ({ ...f, beneficios: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Vagas</Label>
            <Input type="number" min={1} value={form.quantidade_vagas} onChange={(e) => setForm((f) => ({ ...f, quantidade_vagas: Number(e.target.value) }))} />
          </div>
          {erro && <p className="text-destructive text-sm">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button
            disabled={salvando}
            onClick={() =>
              startTransition(async () => {
                setErro(null);
                const r = await salvarSalaVip(form);
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
