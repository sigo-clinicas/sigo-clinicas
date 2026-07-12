"use client";

// Porta de reference/base44 src/pages/Profissionais.jsx +
// src/components/profissionais/ProfissionalModal.jsx.
import { useState, useTransition } from "react";
import { Plus, Edit2, Trash2, Stethoscope, X } from "lucide-react";

import {
  excluirProfissional,
  salvarProfissional,
  type IntervaloInput,
  type ProfissionalInput,
} from "@/lib/actions/profissionais";
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

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
  { id: 0, label: "Dom" },
];
const CORES = [
  "#1E3A5F", "#2563EB", "#7C3AED", "#059669",
  "#DC2626", "#D97706", "#0891B2", "#BE185D",
];
// Aba "Bloqueios" é adição do legado (profissional_has_intervalo)
const TABS = [
  { id: "dados", label: "Dados" },
  { id: "servicos", label: "Serviços & Comissões" },
  { id: "bloqueios", label: "Bloqueios" },
];

type Opcao = { id: string; nome: string };

export type ProfissionalLinha = {
  id: string;
  nome: string;
  numero_registro: string | null;
  telefone: string | null;
  email: string | null;
  cor: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  dias_atendimento: number[];
  ativo: boolean;
  user_id: string | null;
  profissional_especialidade: { especialidade_id: string }[];
  profissional_convenio: { convenio_id: string }[];
  profissional_servico: {
    servico_id: string;
    tipo_comissao: "percentual" | "valor_fixo";
    valor_comissao: number;
  }[];
  profissional_intervalo: {
    id: string;
    tipo: "fixo" | "pontual";
    motivo: string;
    dia_semana: number | null;
    hora_inicio: string | null;
    hora_fim: string | null;
    data_hora_inicio: string | null;
    data_hora_fim: string | null;
  }[];
};

export function ProfissionaisClient({
  profissionais,
  servicos,
  convenios,
  especialidadesDaClinica,
  podeGerenciar,
  meuUserId,
}: {
  profissionais: ProfissionalLinha[];
  servicos: Opcao[];
  convenios: Opcao[];
  especialidadesDaClinica: Opcao[];
  podeGerenciar: boolean;
  meuUserId: string;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<ProfissionalLinha | null>(null);
  const [, startTransition] = useTransition();

  const nomeEspecialidades = (p: ProfissionalLinha) =>
    p.profissional_especialidade
      .map((pe) => especialidadesDaClinica.find((e) => e.id === pe.especialidade_id)?.nome)
      .filter(Boolean)
      .join(", ");

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profissionais</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profissionais.length} cadastrados
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
            <Plus className="w-4 h-4" /> Novo Profissional
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profissionais.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum profissional cadastrado.</p>
          </div>
        ) : (
          profissionais.map((p) => {
            const podeEditarEste =
              podeGerenciar || p.user_id === meuUserId;
            return (
              <div key={p.id} className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: p.cor || "#1E3A5F" }}
                    >
                      {p.nome[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{p.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {nomeEspecialidades(p) || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {podeEditarEste && (
                      <button
                        onClick={() => {
                          setSelecionado(p);
                          setModalAberto(true);
                        }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {podeGerenciar && (
                      <button
                        onClick={() => {
                          if (!confirm("Excluir profissional?")) return;
                          startTransition(async () => {
                            await excluirProfissional(p.id);
                          });
                        }}
                        className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {p.numero_registro && (
                    <div>
                      Registro:{" "}
                      <span className="text-foreground font-medium">
                        {p.numero_registro}
                      </span>
                    </div>
                  )}
                  {p.telefone && (
                    <div>
                      Tel: <span className="text-foreground">{p.telefone}</span>
                    </div>
                  )}
                  {p.horario_inicio && (
                    <div>
                      Horário:{" "}
                      <span className="text-foreground">
                        {p.horario_inicio.slice(0, 5)} — {p.horario_fim?.slice(0, 5)}
                      </span>
                    </div>
                  )}
                  {p.dias_atendimento.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.dias_atendimento.map((d) => (
                        <span
                          key={d}
                          className="px-1.5 py-0.5 bg-secondary rounded text-xs font-medium"
                        >
                          {DIAS_CURTOS[d]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  className={`mt-3 text-xs font-medium ${
                    p.ativo ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {p.ativo ? "● Ativo" : "● Inativo"}
                </div>
              </div>
            );
          })
        )}
      </div>

      {modalAberto && (
        <ProfissionalModal
          profissional={selecionado}
          servicos={servicos}
          convenios={convenios}
          especialidades={especialidadesDaClinica}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  );
}

function ProfissionalModal({
  profissional,
  servicos,
  convenios,
  especialidades,
  onClose,
}: {
  profissional: ProfissionalLinha | null;
  servicos: Opcao[];
  convenios: Opcao[];
  especialidades: Opcao[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState("dados");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const [form, setForm] = useState<ProfissionalInput>({
    id: profissional?.id,
    nome: profissional?.nome ?? "",
    numero_registro: profissional?.numero_registro ?? "",
    telefone: profissional?.telefone ?? "",
    email: profissional?.email ?? "",
    cor: profissional?.cor ?? "#1E3A5F",
    horario_inicio: profissional?.horario_inicio?.slice(0, 5) ?? "08:00",
    horario_fim: profissional?.horario_fim?.slice(0, 5) ?? "18:00",
    dias_atendimento: profissional?.dias_atendimento ?? [1, 2, 3, 4, 5],
    ativo: profissional?.ativo ?? true,
    especialidade_ids:
      profissional?.profissional_especialidade.map((pe) => pe.especialidade_id) ?? [],
    convenio_ids:
      profissional?.profissional_convenio.map((pc) => pc.convenio_id) ?? [],
    servicos_comissao:
      profissional?.profissional_servico.map((ps) => ({
        servico_id: ps.servico_id,
        tipo_comissao: ps.tipo_comissao,
        valor_comissao: Number(ps.valor_comissao),
      })) ?? [],
    intervalos:
      profissional?.profissional_intervalo.map((iv) => ({
        tipo: iv.tipo,
        motivo: iv.motivo,
        dia_semana: iv.dia_semana,
        hora_inicio: iv.hora_inicio?.slice(0, 5) ?? null,
        hora_fim: iv.hora_fim?.slice(0, 5) ?? null,
        data_hora_inicio: iv.data_hora_inicio,
        data_hora_fim: iv.data_hora_fim,
      })) ?? [],
  });

  function set<K extends keyof ProfissionalInput>(k: K, v: ProfissionalInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleDia(id: number) {
    set(
      "dias_atendimento",
      form.dias_atendimento.includes(id)
        ? form.dias_atendimento.filter((d) => d !== id)
        : [...form.dias_atendimento, id]
    );
  }

  const servicosNaoVinculados = servicos.filter(
    (s) => !form.servicos_comissao.find((sc) => sc.servico_id === s.id)
  );

  function handleSave() {
    if (!form.nome.trim()) {
      setErro("Nome é obrigatório");
      return;
    }
    startTransition(async () => {
      const resultado = await salvarProfissional(form);
      if (resultado.erro) setErro(resultado.erro);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">
            {profissional ? "Editar Profissional" : "Novo Profissional"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-border shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === "dados" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nome completo *</Label>
                <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Especialidades</Label>
                {especialidades.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Selecione as especialidades da clínica em Configurações →
                    Especialidades.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {especialidades.map((esp) => {
                      const marcada = form.especialidade_ids.includes(esp.id);
                      return (
                        <button
                          key={esp.id}
                          type="button"
                          onClick={() =>
                            set(
                              "especialidade_ids",
                              marcada
                                ? form.especialidade_ids.filter((id) => id !== esp.id)
                                : [...form.especialidade_ids, esp.id]
                            )
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            marcada
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {esp.nome}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>CRM / Registro</Label>
                <Input
                  value={form.numero_registro ?? ""}
                  onChange={(e) => set("numero_registro", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={form.telefone ?? ""}
                  onChange={(e) => set("telefone", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Horário Início</Label>
                <Input
                  type="time"
                  value={form.horario_inicio ?? ""}
                  onChange={(e) => set("horario_inicio", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Horário Fim</Label>
                <Input
                  type="time"
                  value={form.horario_fim ?? ""}
                  onChange={(e) => set("horario_fim", e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Dias de Atendimento</Label>
                <div className="flex flex-wrap gap-2">
                  {DIAS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDia(d.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        form.dias_atendimento.includes(d.id)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Cor na Agenda</Label>
                <div className="flex flex-wrap gap-2">
                  {CORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("cor", c)}
                      className={`w-7 h-7 rounded-full transition-all ${
                        form.cor === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Convênios aceitos</Label>
                {convenios.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum convênio cadastrado.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {convenios.map((cv) => {
                      const marcado = form.convenio_ids.includes(cv.id);
                      return (
                        <button
                          key={cv.id}
                          type="button"
                          onClick={() =>
                            set(
                              "convenio_ids",
                              marcado
                                ? form.convenio_ids.filter((id) => id !== cv.id)
                                : [...form.convenio_ids, cv.id]
                            )
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            marcado
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {cv.nome}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.ativo ? "ativo" : "inativo"}
                  onValueChange={(v) => set("ativo", v === "ativo")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {tab === "servicos" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Apenas serviços vinculados ao profissional aparecerão no
                agendamento e nos filtros.
              </p>

              {servicosNaoVinculados.length > 0 && (
                <div className="flex gap-2">
                  <Select
                    onValueChange={(servicoId) =>
                      set("servicos_comissao", [
                        ...form.servicos_comissao,
                        { servico_id: servicoId, tipo_comissao: "percentual", valor_comissao: 0 },
                      ])
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Adicionar serviço..." />
                    </SelectTrigger>
                    <SelectContent>
                      {servicosNaoVinculados.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.servicos_comissao.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
                  <p className="text-sm">Nenhum serviço vinculado.</p>
                  <p className="text-xs mt-1">Selecione acima para adicionar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-3 py-1">
                    <span className="col-span-5 text-xs font-medium text-muted-foreground uppercase">Serviço</span>
                    <span className="col-span-3 text-xs font-medium text-muted-foreground uppercase">Tipo</span>
                    <span className="col-span-3 text-xs font-medium text-muted-foreground uppercase">Comissão</span>
                    <span className="col-span-1" />
                  </div>
                  {form.servicos_comissao.map((sc, idx) => (
                    <div
                      key={sc.servico_id}
                      className="grid grid-cols-12 gap-2 items-center bg-muted/30 rounded-lg px-3 py-2 border border-border"
                    >
                      <div className="col-span-5 text-sm font-medium truncate">
                        {servicos.find((s) => s.id === sc.servico_id)?.nome ?? "—"}
                      </div>
                      <div className="col-span-3">
                        <Select
                          value={sc.tipo_comissao}
                          onValueChange={(v) =>
                            set(
                              "servicos_comissao",
                              form.servicos_comissao.map((x, i) =>
                                i === idx
                                  ? { ...x, tipo_comissao: v as "percentual" | "valor_fixo" }
                                  : x
                              )
                            )
                          }
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentual">% Percentual</SelectItem>
                            <SelectItem value="valor_fixo">R$ Fixo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            value={sc.valor_comissao}
                            onChange={(e) =>
                              set(
                                "servicos_comissao",
                                form.servicos_comissao.map((x, i) =>
                                  i === idx
                                    ? { ...x, valor_comissao: Number(e.target.value) }
                                    : x
                                )
                              )
                            }
                            className="h-7 text-xs pr-6"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {sc.tipo_comissao === "percentual" ? "%" : "R$"}
                          </span>
                        </div>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={() =>
                            set(
                              "servicos_comissao",
                              form.servicos_comissao.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "bloqueios" && (
            <BloqueiosTab
              intervalos={form.intervalos}
              onChange={(intervalos) => set("intervalos", intervalos)}
            />
          )}
        </div>

        {erro && <p className="px-5 pb-2 text-sm text-destructive">{erro}</p>}

        <div className="flex justify-end gap-2 p-5 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Bloqueios de agenda (legado profissional_has_intervalo): fixo = recorrente
// por dia da semana (ex.: almoço); pontual = janela de datas (ex.: férias).
function BloqueiosTab({
  intervalos,
  onChange,
}: {
  intervalos: IntervaloInput[];
  onChange: (intervalos: IntervaloInput[]) => void;
}) {
  const [novo, setNovo] = useState<IntervaloInput>({
    tipo: "fixo",
    motivo: "Almoço",
    dia_semana: 1,
    hora_inicio: "12:00",
    hora_fim: "13:00",
    data_hora_inicio: null,
    data_hora_fim: null,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Períodos em que o profissional não recebe agendamentos — recorrentes
        (fixo) ou pontuais (férias, congressos).
      </p>

      <div className="grid grid-cols-12 gap-2 items-end bg-muted/30 rounded-lg p-3 border border-border">
        <div className="col-span-3 space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={novo.tipo}
            onValueChange={(v) =>
              setNovo((n) => ({ ...n, tipo: v as "fixo" | "pontual" }))
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixo">Fixo (semanal)</SelectItem>
              <SelectItem value="pontual">Pontual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3 space-y-1">
          <Label className="text-xs">Motivo</Label>
          <Input
            className="h-8 text-xs"
            value={novo.motivo}
            onChange={(e) => setNovo((n) => ({ ...n, motivo: e.target.value }))}
          />
        </div>
        {novo.tipo === "fixo" ? (
          <>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Dia</Label>
              <Select
                value={String(novo.dia_semana ?? 1)}
                onValueChange={(v) =>
                  setNovo((n) => ({ ...n, dia_semana: Number(v) }))
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Início</Label>
              <Input
                type="time"
                className="h-8 text-xs"
                value={novo.hora_inicio ?? ""}
                onChange={(e) =>
                  setNovo((n) => ({ ...n, hora_inicio: e.target.value }))
                }
              />
            </div>
            <div className="col-span-1 space-y-1">
              <Label className="text-xs">Fim</Label>
              <Input
                type="time"
                className="h-8 text-xs"
                value={novo.hora_fim ?? ""}
                onChange={(e) =>
                  setNovo((n) => ({ ...n, hora_fim: e.target.value }))
                }
              />
            </div>
          </>
        ) : (
          <>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">De</Label>
              <Input
                type="datetime-local"
                className="h-8 text-xs"
                value={novo.data_hora_inicio ?? ""}
                onChange={(e) =>
                  setNovo((n) => ({ ...n, data_hora_inicio: e.target.value }))
                }
              />
            </div>
            <div className="col-span-3 space-y-1">
              <Label className="text-xs">Até</Label>
              <Input
                type="datetime-local"
                className="h-8 text-xs"
                value={novo.data_hora_fim ?? ""}
                onChange={(e) =>
                  setNovo((n) => ({ ...n, data_hora_fim: e.target.value }))
                }
              />
            </div>
          </>
        )}
        <div className="col-span-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              if (novo.tipo === "fixo" && (!novo.hora_inicio || !novo.hora_fim)) return;
              if (novo.tipo === "pontual" && (!novo.data_hora_inicio || !novo.data_hora_fim)) return;
              onChange([...intervalos, novo]);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {intervalos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl text-sm">
          Nenhum bloqueio cadastrado.
        </div>
      ) : (
        <div className="space-y-2">
          {intervalos.map((iv, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 border border-border text-sm"
            >
              <div>
                <span className="font-medium">{iv.motivo}</span>{" "}
                <span className="text-muted-foreground text-xs">
                  {iv.tipo === "fixo"
                    ? `toda ${DIAS_CURTOS[iv.dia_semana ?? 0]} ${iv.hora_inicio}–${iv.hora_fim}`
                    : `${iv.data_hora_inicio?.replace("T", " ")} → ${iv.data_hora_fim?.replace("T", " ")}`}
                </span>
              </div>
              <button
                onClick={() => onChange(intervalos.filter((_, i) => i !== idx))}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
