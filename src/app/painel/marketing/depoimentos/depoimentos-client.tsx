"use client";

// Porta de reference/base44 Depoimentos.jsx — moderação (aprovar/recusar),
// publicação (switch), destaque (dependente de publicar), solicitação por link.
import { useMemo, useState, useTransition } from "react";
import { Check, Link2, Plus, Star, Trash2, X } from "lucide-react";

import {
  atualizarExposicaoDepoimento,
  excluirDepoimento,
  moderarDepoimento,
  salvarDepoimento,
  solicitarDepoimento,
  type DepoimentoInput,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Opcao = { id: string; nome: string };
type Depoimento = {
  id: string;
  paciente_nome: string;
  texto: string;
  nota: number | null;
  profissional_id: string | null;
  servico_id: string | null;
  status: "pendente" | "aprovado" | "recusado";
  publicar_no_site: boolean;
  destaque: boolean;
  origem: string;
  created_at: string;
};

const SEM = "__sem__";

export function DepoimentosClient({
  depoimentos,
  profissionais,
  servicos,
}: {
  depoimentos: Depoimento[];
  profissionais: Opcao[];
  servicos: Opcao[];
}) {
  const [aba, setAba] = useState<"todos" | "pendente" | "aprovado" | "site">("todos");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Depoimento | null>(null);
  const [linkModal, setLinkModal] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const kpis = useMemo(
    () => ({
      total: depoimentos.length,
      pendentes: depoimentos.filter((d) => d.status === "pendente").length,
      aprovados: depoimentos.filter((d) => d.status === "aprovado").length,
      noSite: depoimentos.filter((d) => d.publicar_no_site).length,
    }),
    [depoimentos]
  );

  const lista = depoimentos.filter((d) => {
    if (aba === "pendente") return d.status === "pendente";
    if (aba === "aprovado") return d.status === "aprovado";
    if (aba === "site") return d.publicar_no_site;
    return true;
  });

  function moderar(id: string, status: "aprovado" | "recusado") {
    startTransition(async () => {
      await moderarDepoimento(id, status);
    });
  }
  function exposicao(d: Depoimento, publicar: boolean, destaque: boolean) {
    startTransition(async () => {
      await atualizarExposicaoDepoimento(d.id, publicar, destaque);
    });
  }
  function excluir(id: string) {
    if (!confirm("Excluir depoimento?")) return;
    startTransition(async () => {
      await excluirDepoimento(id);
    });
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Depoimentos</h1>
        <Button
          onClick={() => {
            setEditando(null);
            setModal(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Novo depoimento
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total", v: kpis.total },
          { label: "Pendentes", v: kpis.pendentes },
          { label: "Aprovados", v: kpis.aprovados },
          { label: "No site", v: kpis.noSite },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-muted-foreground text-xs">{k.label}</p>
            <p className="text-xl font-semibold">{k.v}</p>
          </div>
        ))}
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="site">No site</TabsTrigger>
        </TabsList>
        <TabsContent value={aba} className="space-y-2">
          {lista.length === 0 && (
            <p className="text-muted-foreground rounded-lg border border-dashed border-border p-6 text-center text-sm">
              Nenhum depoimento.
            </p>
          )}
          {lista.map((d) => (
            <div key={d.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{d.paciente_nome}</span>
                    {d.nota != null && (
                      <span className="flex gap-0.5 text-amber-500">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className="h-3 w-3" fill={i < d.nota! ? "currentColor" : "none"} />
                        ))}
                      </span>
                    )}
                    <span className="text-muted-foreground text-xs capitalize">· {d.status}</span>
                  </div>
                  {d.texto ? (
                    <p className="text-muted-foreground mt-1 text-sm">{d.texto}</p>
                  ) : (
                    <p className="text-muted-foreground mt-1 text-xs italic">
                      Aguardando preenchimento pelo paciente (link enviado).
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => excluir(d.id)}
                  className="text-destructive p-1 hover:opacity-70"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3">
                {d.status === "pendente" && d.texto && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => moderar(d.id, "aprovado")}>
                      <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => moderar(d.id, "recusado")}>
                      <X className="mr-1 h-3.5 w-3.5" /> Recusar
                    </Button>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={d.publicar_no_site}
                    disabled={d.status !== "aprovado"}
                    onCheckedChange={(v) => exposicao(d, v, d.destaque)}
                  />
                  No site
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={d.destaque}
                    disabled={!d.publicar_no_site}
                    onCheckedChange={(v) => exposicao(d, d.publicar_no_site, v)}
                  />
                  Destaque
                </label>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {modal && (
        <DepoimentoModal
          open={modal}
          onOpenChange={setModal}
          depoimento={editando}
          profissionais={profissionais}
          servicos={servicos}
          onSolicitado={(token) => setLinkModal(token)}
        />
      )}

      {linkModal && (
        <Dialog open onOpenChange={() => setLinkModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Link de solicitação</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              Envie este link ao paciente para ele deixar o depoimento:
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border p-2 text-xs">
              <Link2 className="h-4 w-4 shrink-0" />
              <code className="truncate">/depoimento/{linkModal}</code>
            </div>
            <p className="text-muted-foreground text-xs">
              (a página pública de preenchimento por token é entregue como
              incremento — o registro pendente já foi criado.)
            </p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DepoimentoModal({
  open,
  onOpenChange,
  depoimento,
  profissionais,
  servicos,
  onSolicitado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  depoimento: Depoimento | null;
  profissionais: Opcao[];
  servicos: Opcao[];
  onSolicitado: (token: string) => void;
}) {
  const [form, setForm] = useState<DepoimentoInput>({
    id: depoimento?.id,
    paciente_nome: depoimento?.paciente_nome ?? "",
    texto: depoimento?.texto ?? "",
    nota: depoimento?.nota ?? 5,
    profissional_id: depoimento?.profissional_id ?? null,
    servico_id: depoimento?.servico_id ?? null,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function set<K extends keyof DepoimentoInput>(k: K, v: DepoimentoInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{depoimento ? "Editar" : "Novo"} depoimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome do paciente</Label>
            <Input value={form.paciente_nome} onChange={(e) => set("paciente_nome", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Depoimento</Label>
            <Input value={form.texto} onChange={(e) => set("texto", e.target.value)} placeholder="Texto do depoimento" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Nota</Label>
              <Select value={String(form.nota ?? 5)} onValueChange={(v) => set("nota", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Profissional</Label>
              <Select value={form.profissional_id ?? SEM} onValueChange={(v) => set("profissional_id", v === SEM ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM}>—</SelectItem>
                  {profissionais.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Serviço</Label>
              <Select value={form.servico_id ?? SEM} onValueChange={(v) => set("servico_id", v === SEM ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM}>—</SelectItem>
                  {servicos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {erro && <p className="text-destructive text-sm">{erro}</p>}
        </div>
        <DialogFooter className="justify-between">
          {!depoimento && (
            <Button
              variant="outline"
              disabled={salvando || !form.paciente_nome.trim()}
              onClick={() =>
                startTransition(async () => {
                  const r = await solicitarDepoimento({
                    paciente_nome: form.paciente_nome,
                    profissional_id: form.profissional_id,
                    servico_id: form.servico_id,
                  });
                  if (r.erro) setErro(r.erro);
                  else {
                    onOpenChange(false);
                    if (r.token) onSolicitado(r.token);
                  }
                })
              }
            >
              <Link2 className="mr-1 h-4 w-4" /> Solicitar por link
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              disabled={salvando}
              onClick={() =>
                startTransition(async () => {
                  setErro(null);
                  const r = await salvarDepoimento(form);
                  if (r.erro) setErro(r.erro);
                  else onOpenChange(false);
                })
              }
            >
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
