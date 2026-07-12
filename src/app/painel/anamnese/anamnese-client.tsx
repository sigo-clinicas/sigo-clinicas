"use client";

// Porta de reference/base44 src/pages/anamnese/FormulariosAnamnese.jsx +
// src/components/anamnese/FormularioAnamneseModal.jsx (builder). Sem acoplamento
// ao @base44/sdk — mutações via Server Actions com client de sessão.
import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, ClipboardList, X, GripVertical, Power } from "lucide-react";

import {
  salvarFormulario,
  alternarAtivoFormulario,
  excluirFormulario,
  type FormularioInput,
  type Pergunta,
  type TipoPergunta,
} from "@/lib/actions/anamnese";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FormularioLinha = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  perguntas: Pergunta[];
};

const TIPOS: { value: TipoPergunta; label: string }[] = [
  { value: "texto", label: "Texto curto" },
  { value: "texto_longo", label: "Texto longo" },
  { value: "sim_nao", label: "Sim / Não" },
  { value: "multipla_escolha", label: "Múltipla escolha" },
  { value: "numero", label: "Número" },
];

function novaPergunta(): Pergunta {
  return { id: crypto.randomUUID(), texto: "", tipo: "texto", opcoes: [], obrigatoria: false };
}

export function AnamneseClient({
  formularios,
  podeEditar,
}: {
  formularios: FormularioLinha[];
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState<FormularioLinha | "novo" | null>(null);
  const [, startTransition] = useTransition();

  function toggle(f: FormularioLinha) {
    startTransition(async () => {
      await alternarAtivoFormulario(f.id, !f.ativo);
    });
  }
  function excluir(f: FormularioLinha) {
    if (!confirm(`Excluir o formulário "${f.nome}"?`)) return;
    startTransition(async () => {
      await excluirFormulario(f.id);
    });
  }

  if (editando !== null) {
    return (
      <ModalFormulario
        formulario={editando === "novo" ? null : editando}
        onClose={() => setEditando(null)}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Formulários de Anamnese</h1>
          <p className="text-sm text-muted-foreground">
            Monte questionários e envie por link para o paciente preencher sem login.
          </p>
        </div>
        {podeEditar && (
          <Button size="sm" className="gap-1.5" onClick={() => setEditando("novo")}>
            <Plus className="w-3.5 h-3.5" /> Novo Formulário
          </Button>
        )}
      </div>

      {formularios.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum formulário criado.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {formularios.map((f) => (
            <div key={f.id} className="bg-card border border-border rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium text-sm truncate">{f.nome}</h3>
                  {f.descricao && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{f.descricao}</p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    f.ativo ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {f.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{f.perguntas.length} pergunta(s)</p>
              {podeEditar && (
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                  <button onClick={() => setEditando(f)} className="text-muted-foreground hover:text-foreground p-1" title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggle(f)} className="text-muted-foreground hover:text-foreground p-1" title={f.ativo ? "Desativar" : "Ativar"}>
                    <Power className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => excluir(f)} className="text-muted-foreground hover:text-destructive p-1 ml-auto" title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModalFormulario({
  formulario,
  onClose,
}: {
  formulario: FormularioLinha | null;
  onClose: () => void;
}) {
  const [nome, setNome] = useState(formulario?.nome ?? "");
  const [descricao, setDescricao] = useState(formulario?.descricao ?? "");
  const [ativo, setAtivo] = useState(formulario?.ativo ?? true);
  const [perguntas, setPerguntas] = useState<Pergunta[]>(formulario?.perguntas ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function upd(idx: number, campo: keyof Pergunta, valor: unknown) {
    setPerguntas((l) => l.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
  }
  function addOpcao(idx: number) {
    setPerguntas((l) => l.map((p, i) => (i === idx ? { ...p, opcoes: [...p.opcoes, ""] } : p)));
  }
  function updOpcao(idx: number, oi: number, valor: string) {
    setPerguntas((l) =>
      l.map((p, i) => (i === idx ? { ...p, opcoes: p.opcoes.map((o, j) => (j === oi ? valor : o)) } : p))
    );
  }
  function removeOpcao(idx: number, oi: number) {
    setPerguntas((l) =>
      l.map((p, i) => (i === idx ? { ...p, opcoes: p.opcoes.filter((_, j) => j !== oi) } : p))
    );
  }

  function salvar() {
    const payload: FormularioInput = {
      id: formulario?.id,
      nome,
      descricao,
      ativo,
      perguntas,
    };
    startTransition(async () => {
      const r = await salvarFormulario(payload);
      if (r.erro) setErro(r.erro);
      else onClose();
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
        ← Voltar
      </button>
      <h1 className="text-xl font-semibold">
        {formulario ? "Editar Formulário" : "Novo Formulário"}
      </h1>

      <div className="grid gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Anamnese Estética" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Descrição</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo (disponível para envio)
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Perguntas</h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPerguntas((l) => [...l, novaPergunta()])}>
            <Plus className="w-3.5 h-3.5" /> Adicionar Pergunta
          </Button>
        </div>

        {perguntas.map((p, i) => (
          <div key={p.id} className="border border-border rounded-xl p-3 space-y-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">Pergunta {i + 1}</span>
              <button
                onClick={() => setPerguntas((l) => l.filter((_, j) => j !== i))}
                className="ml-auto text-muted-foreground hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <Input value={p.texto} onChange={(e) => upd(i, "texto", e.target.value)} placeholder="Enunciado da pergunta" />
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={p.tipo}
                onChange={(e) => upd(i, "tipo", e.target.value as TipoPergunta)}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={p.obrigatoria}
                  onChange={(e) => upd(i, "obrigatoria", e.target.checked)}
                />
                Obrigatória
              </label>
            </div>

            {p.tipo === "multipla_escolha" && (
              <div className="space-y-1.5 pl-2 border-l-2 border-border">
                <Label className="text-xs">Opções</Label>
                {p.opcoes.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <Input value={o} onChange={(e) => updOpcao(i, oi, e.target.value)} placeholder={`Opção ${oi + 1}`} />
                    <button onClick={() => removeOpcao(i, oi)} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => addOpcao(i)}>
                  <Plus className="w-3 h-3" /> Adicionar opção
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar Formulário"}
        </Button>
      </div>
    </div>
  );
}
