"use client";

// Porta (parcial) de reference/base44 src/pages/financeiro/Convenios.jsx —
// cadastro. Fechamento de guia CSV: S4 (D4.4).
import { useState, useTransition } from "react";
import { Plus, Edit2, Trash2, X, FileSpreadsheet } from "lucide-react";

import {
  excluirConvenio,
  salvarConvenio,
  type ConvenioInput,
} from "@/lib/actions/servicos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ConvenioLinha = {
  id: string;
  nome: string;
  codigo: string | null;
  tipo: "plano_saude" | "particular" | "sus" | "outros";
  contato: string | null;
  prazo_pagamento_dias: number | null;
  observacoes: string | null;
  ativo: boolean;
};

const TIPO_LABEL: Record<ConvenioLinha["tipo"], string> = {
  plano_saude: "Plano de Saúde",
  particular: "Particular",
  sus: "SUS",
  outros: "Outros",
};

export function ConveniosClient({
  convenios,
  podeGerenciar,
}: {
  convenios: ConvenioLinha[];
  podeGerenciar: boolean;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<ConvenioLinha | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Convênios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {convenios.length} cadastrado(s) · fechamento de guia (CSV) chega
            no Sprint 4
          </p>
        </div>
        {podeGerenciar && (
          <Button
            onClick={() => {
              setSelecionado(null);
              setModalAberto(true);
            }}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" /> Novo Convênio
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {convenios.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum convênio cadastrado.</p>
          </div>
        ) : (
          convenios.map((c) => (
            <div key={c.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-sm">{c.nome}</h3>
                  {c.codigo && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cód: {c.codigo}
                    </p>
                  )}
                </div>
                {podeGerenciar && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setSelecionado(c);
                        setModalAberto(true);
                      }}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm("Excluir convênio?")) return;
                        startTransition(async () => {
                          await excluirConvenio(c.id);
                        });
                      }}
                      className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <Badge variant="secondary">{TIPO_LABEL[c.tipo]}</Badge>
                {c.prazo_pagamento_dias != null && (
                  <span>Prazo: {c.prazo_pagamento_dias} dias</span>
                )}
                {!c.ativo && (
                  <span className="text-red-500 font-medium">● Inativo</span>
                )}
              </div>
              {c.contato && (
                <p className="text-xs text-muted-foreground mt-2">
                  Contato: {c.contato}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {modalAberto && (
        <ConvenioModal convenio={selecionado} onClose={() => setModalAberto(false)} />
      )}
    </div>
  );
}

function ConvenioModal({
  convenio,
  onClose,
}: {
  convenio: ConvenioLinha | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ConvenioInput>({
    id: convenio?.id,
    nome: convenio?.nome ?? "",
    codigo: convenio?.codigo ?? "",
    tipo: convenio?.tipo ?? "plano_saude",
    contato: convenio?.contato ?? "",
    prazo_pagamento_dias: convenio?.prazo_pagamento_dias ?? null,
    observacoes: convenio?.observacoes ?? "",
    ativo: convenio?.ativo ?? true,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function set<K extends keyof ConvenioInput>(k: K, v: ConvenioInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">
            {convenio ? "Editar Convênio" : "Novo Convênio"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input
                value={form.codigo ?? ""}
                onChange={(e) => set("codigo", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => set("tipo", v as ConvenioInput["tipo"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plano_saude">Plano de Saúde</SelectItem>
                  <SelectItem value="particular">Particular</SelectItem>
                  <SelectItem value="sus">SUS</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contato</Label>
              <Input
                value={form.contato ?? ""}
                onChange={(e) => set("contato", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo de pagamento (dias)</Label>
              <Input
                type="number"
                min={0}
                value={form.prazo_pagamento_dias ?? ""}
                onChange={(e) =>
                  set(
                    "prazo_pagamento_dias",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Input
              value={form.observacoes ?? ""}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => set("ativo", e.target.checked)}
              className="rounded"
            />
            Ativo
          </label>
        </div>
        {erro && <p className="px-5 pb-2 text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={salvando}
            onClick={() =>
              startTransition(async () => {
                const r = await salvarConvenio(form);
                if (r.erro) setErro(r.erro);
                else onClose();
              })
            }
          >
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
