"use client";

// Porta (focada em agendamento) de reference/base44
// src/components/agenda/ConsultaModal.jsx. A integração com venda de
// produto / orçamento pré-pago (ShoppingBag, gerarVenda) depende do funil
// comercial e entra no Sprint 3.
import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { X, Trash2 } from "lucide-react";

import {
  excluirConsulta,
  salvarConsulta,
  type ConsultaInput,
} from "@/lib/actions/consultas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConsultaLinha, ProfissionalAgenda } from "./agenda-client";

const STATUS_OPTS: ConsultaInput["status"][] = [
  "agendado",
  "confirmado",
  "em_atendimento",
  "concluido",
  "cancelado",
  "faltou",
];
const TIPO_OPTS: ConsultaInput["tipo"][] = [
  "consulta",
  "retorno",
  "exame",
  "procedimento",
];
const STATUS_LABEL: Record<ConsultaInput["status"], string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_atendimento: "Em Atendimento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};
const TIPO_LABEL: Record<ConsultaInput["tipo"], string> = {
  consulta: "Consulta",
  retorno: "Retorno",
  exame: "Exame",
  procedimento: "Procedimento",
};

function paraInputLocal(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export function ConsultaModal({
  consulta,
  slot,
  profissionais,
  pacientes,
  servicos,
  convenios,
  podeEditar,
  onClose,
}: {
  consulta: ConsultaLinha | null;
  slot: { data: Date; profId: string } | null;
  profissionais: ProfissionalAgenda[];
  pacientes: { id: string; nome: string }[];
  servicos: { id: string; nome: string; duracao_minutos: number }[];
  convenios: { id: string; nome: string }[];
  podeEditar: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ConsultaInput>({
    id: consulta?.id,
    paciente_id: consulta?.paciente_id ?? "",
    profissional_id: consulta?.profissional_id ?? slot?.profId ?? "",
    convenio_id: consulta?.convenio_id ?? null,
    data_hora: consulta
      ? paraInputLocal(consulta.data_hora)
      : slot
        ? paraInputLocal(slot.data.toISOString())
        : "",
    duracao_minutos: consulta?.duracao_minutos ?? 30,
    tipo: consulta?.tipo ?? "consulta",
    status: consulta?.status ?? "agendado",
    valor: consulta?.valor ?? null,
    observacoes: consulta?.observacoes ?? null,
    servico_ids: consulta?.servico_ids ?? [],
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function set<K extends keyof ConsultaInput>(k: K, v: ConsultaInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Só os serviços que o profissional executa (profissional_servico);
  // se ele não tem vínculos, mostra todos (fallback do Base44).
  const profSel = profissionais.find((p) => p.id === form.profissional_id);
  const servicosDisponiveis = useMemo(() => {
    if (!profSel || profSel.servico_ids.length === 0) return servicos;
    return servicos.filter((s) => profSel.servico_ids.includes(s.id));
  }, [profSel, servicos]);

  function toggleServico(id: string) {
    const s = servicos.find((x) => x.id === id);
    const jaTem = form.servico_ids.includes(id);
    const novos = jaTem
      ? form.servico_ids.filter((x) => x !== id)
      : [...form.servico_ids, id];
    // Ao adicionar o 1º serviço, adota a duração dele (comportamento Base44)
    setForm((f) => ({
      ...f,
      servico_ids: novos,
      duracao_minutos:
        !jaTem && f.servico_ids.length === 0 && s
          ? s.duracao_minutos
          : f.duracao_minutos,
    }));
  }

  const somenteLeitura = !podeEditar;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">
            {consulta ? "Editar Agendamento" : "Novo Agendamento"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Paciente *</Label>
            <Select
              value={form.paciente_id || "nenhum"}
              onValueChange={(v) => set("paciente_id", v === "nenhum" ? "" : v)}
              disabled={somenteLeitura}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar paciente" />
              </SelectTrigger>
              <SelectContent>
                {pacientes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Profissional *</Label>
              <Select
                value={form.profissional_id || "nenhum"}
                onValueChange={(v) =>
                  set("profissional_id", v === "nenhum" ? "" : v)
                }
                disabled={somenteLeitura}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {profissionais.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Convênio</Label>
              <Select
                value={form.convenio_id ?? "particular"}
                onValueChange={(v) =>
                  set("convenio_id", v === "particular" ? null : v)
                }
                disabled={somenteLeitura}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Particular" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="particular">Particular</SelectItem>
                  {convenios.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data e Hora *</Label>
              <Input
                type="datetime-local"
                value={form.data_hora}
                onChange={(e) => set("data_hora", e.target.value)}
                disabled={somenteLeitura}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duração (min)</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={form.duracao_minutos}
                onChange={(e) => set("duracao_minutos", Number(e.target.value))}
                disabled={somenteLeitura}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => set("tipo", v as ConsultaInput["tipo"])}
                disabled={somenteLeitura}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as ConsultaInput["status"])}
                disabled={somenteLeitura}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Serviços</Label>
            {servicosDisponiveis.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum serviço disponível para este profissional.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {servicosDisponiveis.map((s) => {
                  const marcado = form.servico_ids.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={somenteLeitura}
                      onClick={() => toggleServico(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        marcado
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {s.nome}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.valor ?? ""}
                onChange={(e) =>
                  set("valor", e.target.value === "" ? null : Number(e.target.value))
                }
                disabled={somenteLeitura}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Input
              value={form.observacoes ?? ""}
              onChange={(e) => set("observacoes", e.target.value)}
              placeholder="Opcional"
              disabled={somenteLeitura}
            />
          </div>
        </div>

        {erro && <p className="px-5 pb-2 text-sm text-destructive">{erro}</p>}

        {podeEditar && (
          <div className="flex items-center gap-2 p-5 border-t border-border">
            {consulta && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (!confirm("Excluir este agendamento?")) return;
                  startTransition(async () => {
                    const r = await excluirConsulta(consulta.id);
                    if (r.erro) setErro(r.erro);
                    else onClose();
                  });
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={salvando}
              onClick={() =>
                startTransition(async () => {
                  const r = await salvarConsulta(form);
                  if (r.erro) setErro(r.erro);
                  else onClose();
                })
              }
            >
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
