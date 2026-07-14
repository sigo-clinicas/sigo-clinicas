"use client";

// Porta de reference/base44 src/pages/Agenda.jsx — grade multiagenda
// (dia/semana/mês × profissional) com pixel parity, e ConsultaModal focado
// no agendamento.
import { useMemo, useState } from "react";
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Users, Search, X } from "lucide-react";

import { profissionalDisponivel, type IntervaloDisponibilidade } from "@/lib/disponibilidade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsultaModal } from "./consulta-modal";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7h às 19h

export const STATUS_CORES: Record<string, string> = {
  agendado: "bg-blue-100 border-blue-400 text-blue-800",
  confirmado: "bg-green-100 border-green-400 text-green-800",
  em_atendimento: "bg-yellow-100 border-yellow-400 text-yellow-800",
  concluido: "bg-gray-100 border-gray-400 text-gray-700",
  cancelado: "bg-red-100 border-red-300 text-red-700 opacity-60",
  faltou: "bg-orange-100 border-orange-400 text-orange-700",
};

export const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_atendimento: "Em Atend.",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

export type StatusConsulta =
  | "agendado"
  | "confirmado"
  | "em_atendimento"
  | "concluido"
  | "cancelado"
  | "faltou";

export type ConsultaLinha = {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  profissional_id: string;
  convenio_id: string | null;
  numero_guia: string | null;
  data_hora: string;
  duracao_minutos: number;
  tipo: "consulta" | "retorno" | "exame" | "procedimento";
  status: StatusConsulta;
  valor: number | null;
  observacoes: string | null;
  servico_ids: string[];
};

export type ProfissionalAgenda = {
  id: string;
  nome: string;
  cor: string | null;
  user_id: string | null;
  dias_atendimento: number[];
  horario_inicio: string | null;
  horario_fim: string | null;
  servico_ids: string[];
  intervalos: IntervaloDisponibilidade[];
};

type Modo = "hoje" | "dia" | "semana" | "mes";

export function AgendaClient({
  consultas,
  profissionais,
  pacientes,
  servicos,
  convenios,
  podeEditar,
  meuUserId,
  ehProfissional,
  termoPaciente,
}: {
  consultas: ConsultaLinha[];
  profissionais: ProfissionalAgenda[];
  pacientes: { id: string; nome: string }[];
  servicos: { id: string; nome: string; duracao_minutos: number }[];
  convenios: { id: string; nome: string }[];
  podeEditar: boolean;
  meuUserId: string;
  ehProfissional: boolean;
  termoPaciente: string;
}) {
  const meuProf = ehProfissional
    ? profissionais.find((p) => p.user_id === meuUserId) ?? null
    : null;

  const [modo, setModo] = useState<Modo>("semana");
  const [semanaAtual, setSemanaAtual] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(new Date());
  const [mesAtual, setMesAtual] = useState(new Date());
  const [filtroPaciente, setFiltroPaciente] = useState("");
  const [profsSelecionados, setProfsSelecionados] = useState<string[]>(
    meuProf ? [meuProf.id] : profissionais.map((p) => p.id)
  );
  const [modalAberto, setModalAberto] = useState(false);
  const [consultaSel, setConsultaSel] = useState<ConsultaLinha | null>(null);
  const [slotSel, setSlotSel] = useState<{ data: Date; profId: string } | null>(
    null
  );

  const inicioSemana = startOfWeek(semanaAtual, { weekStartsOn: 1 });
  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i));
  const diasMes = eachDayOfInterval({
    start: startOfMonth(mesAtual),
    end: endOfMonth(mesAtual),
  });
  const padInicio = startOfMonth(mesAtual).getDay();

  const profsExibidos = useMemo(() => {
    if (meuProf) return [meuProf];
    if (profsSelecionados.length === 0) return profissionais;
    return profissionais.filter((p) => profsSelecionados.includes(p.id));
  }, [profissionais, profsSelecionados, meuProf]);

  const diasExibidos =
    modo === "dia" || modo === "hoje"
      ? [modo === "hoje" ? new Date() : diaSelecionado]
      : diasSemana;

  const consultasFiltradas = useMemo(() => {
    if (!filtroPaciente.trim()) return consultas;
    const termo = filtroPaciente.toLowerCase();
    return consultas.filter((c) =>
      c.paciente_nome.toLowerCase().includes(termo)
    );
  }, [consultas, filtroPaciente]);

  const consultasSlot = (profId: string, dia: Date, hora: number) =>
    consultasFiltradas.filter((c) => {
      if (c.profissional_id !== profId) return false;
      const d = parseISO(c.data_hora);
      return isSameDay(d, dia) && d.getHours() === hora;
    });

  const consultasDia = (dia: Date) =>
    consultasFiltradas.filter((c) => isSameDay(parseISO(c.data_hora), dia));

  function abrirNovo(dia: Date, hora: number, profId: string) {
    const dt = new Date(dia);
    dt.setHours(hora, 0, 0, 0);
    setConsultaSel(null);
    setSlotSel({ data: dt, profId });
    setModalAberto(true);
  }

  function abrirConsulta(c: ConsultaLinha) {
    setConsultaSel(c);
    setSlotSel(null);
    setModalAberto(true);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border bg-card shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold">Agenda</h1>
            <p className="text-xs text-muted-foreground">
              {modo === "hoje" &&
                format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              {modo === "semana" &&
                `${format(inicioSemana, "dd/MM", { locale: ptBR })} — ${format(addDays(inicioSemana, 6), "dd/MM/yyyy", { locale: ptBR })}`}
              {modo === "dia" &&
                format(diaSelecionado, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              {modo === "mes" &&
                format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          {modo !== "hoje" && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (modo === "semana") setSemanaAtual(addDays(semanaAtual, -7));
                  else if (modo === "dia")
                    setDiaSelecionado(addDays(diaSelecionado, -1));
                  else if (modo === "mes") setMesAtual(addMonths(mesAtual, -1));
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSemanaAtual(new Date());
                  setDiaSelecionado(new Date());
                  setMesAtual(new Date());
                }}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (modo === "semana") setSemanaAtual(addDays(semanaAtual, 7));
                  else if (modo === "dia")
                    setDiaSelecionado(addDays(diaSelecionado, 1));
                  else if (modo === "mes") setMesAtual(addMonths(mesAtual, 1));
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(["hoje", "dia", "semana", "mes"] as Modo[]).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={`px-3 py-1.5 font-medium capitalize transition-colors ${
                  modo === m
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {m === "mes" ? "Mês" : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder={`Buscar ${termoPaciente.toLowerCase()}...`}
              value={filtroPaciente}
              onChange={(e) => setFiltroPaciente(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {filtroPaciente && (
              <button
                onClick={() => setFiltroPaciente("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {!meuProf && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium mr-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Profissionais:
              </span>
              {profissionais.map((p) => {
                const ativo = profsSelecionados.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setProfsSelecionados((prev) =>
                        prev.includes(p.id)
                          ? prev.filter((x) => x !== p.id)
                          : [...prev, p.id]
                      )
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                      ativo
                        ? "text-white border-transparent"
                        : "border-border text-muted-foreground bg-card hover:border-primary/40"
                    }`}
                    style={
                      ativo
                        ? {
                            backgroundColor: p.cor || "#1E3A5F",
                            borderColor: p.cor || "#1E3A5F",
                          }
                        : {}
                    }
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: p.cor || "#1E3A5F" }}
                    />
                    {p.nome}
                  </button>
                );
              })}
            </div>
          )}

          {podeEditar && (
            <Button
              onClick={() => {
                setConsultaSel(null);
                const dt = new Date();
                dt.setMinutes(0, 0, 0);
                setSlotSel({
                  data: dt,
                  profId: profsExibidos[0]?.id ?? "",
                });
                setModalAberto(true);
              }}
              className="gap-1.5 ml-auto shrink-0"
              size="sm"
            >
              <Plus className="w-4 h-4" /> Novo Agendamento
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {modo === "mes" ? (
          <div className="p-4">
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground mb-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: padInicio }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {diasMes.map((dia) => {
                const cssDia = consultasDia(dia);
                const isHoje = isSameDay(dia, new Date());
                return (
                  <div
                    key={dia.toString()}
                    onClick={() => {
                      setDiaSelecionado(dia);
                      setModo("dia");
                    }}
                    className={`min-h-[80px] p-1.5 rounded-lg border border-border cursor-pointer hover:border-primary/40 transition-colors ${
                      isHoje ? "bg-primary/5 border-primary/30" : "bg-card"
                    }`}
                  >
                    <div
                      className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isHoje ? "bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      {format(dia, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {cssDia.slice(0, 3).map((c) => (
                        <div
                          key={c.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirConsulta(c);
                          }}
                          className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer ${STATUS_CORES[c.status]}`}
                        >
                          {format(parseISO(c.data_hora), "HH:mm")}{" "}
                          {c.paciente_nome}
                        </div>
                      ))}
                      {cssDia.length > 3 && (
                        <div className="text-[10px] text-muted-foreground">
                          +{cssDia.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : profsExibidos.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <div className="text-center">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum profissional selecionado.</p>
            </div>
          </div>
        ) : (
          <div
            style={{
              minWidth: Math.max(
                700,
                60 + profsExibidos.length * diasExibidos.length * 110
              ),
            }}
          >
            <div
              className="grid sticky top-0 z-10 bg-card border-b border-border"
              style={{
                gridTemplateColumns: `60px repeat(${profsExibidos.length * diasExibidos.length}, minmax(110px, 1fr))`,
              }}
            >
              <div className="border-r border-border" />
              {diasExibidos.map((dia) =>
                profsExibidos.map((prof) => (
                  <div
                    key={`${dia}-${prof.id}`}
                    className={`text-center py-2 border-r border-border ${
                      isSameDay(dia, new Date()) ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      {format(dia, "EEE dd", { locale: ptBR })}
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: prof.cor || "#1E3A5F" }}
                      />
                      <span className="text-xs font-medium text-foreground truncate">
                        {prof.nome.split(" ")[0]}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {HOURS.map((hora) => (
              <div
                key={hora}
                className="grid"
                style={{
                  gridTemplateColumns: `60px repeat(${profsExibidos.length * diasExibidos.length}, minmax(110px, 1fr))`,
                }}
              >
                <div className="border-r border-b border-border text-right pr-2 pt-1 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {String(hora).padStart(2, "0")}:00
                  </span>
                </div>
                {diasExibidos.map((dia) =>
                  profsExibidos.map((prof) => {
                    const dt = new Date(dia);
                    dt.setHours(hora, 0, 0, 0);
                    const disponivel = profissionalDisponivel(
                      {
                        dias_atendimento: prof.dias_atendimento,
                        horario_inicio: prof.horario_inicio,
                        horario_fim: prof.horario_fim,
                        intervalos: prof.intervalos,
                      },
                      dt
                    );
                    const cs = consultasSlot(prof.id, dia, hora);
                    return (
                      <div
                        key={`${dia}-${prof.id}`}
                        className={`border-r border-b border-border min-h-[56px] p-0.5 transition-colors relative ${
                          disponivel
                            ? "cursor-pointer hover:bg-muted/30"
                            : "bg-muted/10 cursor-not-allowed"
                        }`}
                        onClick={() =>
                          disponivel && podeEditar && abrirNovo(dia, hora, prof.id)
                        }
                      >
                        {!disponivel && cs.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-20">
                            <div className="w-full h-px bg-gray-400 rotate-12" />
                          </div>
                        )}
                        {cs.map((c) => (
                          <div
                            key={c.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirConsulta(c);
                            }}
                            className={`rounded border-l-2 px-1 py-0.5 text-xs mb-0.5 cursor-pointer hover:opacity-80 transition-opacity ${STATUS_CORES[c.status]}`}
                          >
                            <div className="font-semibold truncate">
                              {format(parseISO(c.data_hora), "HH:mm")}{" "}
                              {c.paciente_nome}
                            </div>
                            <div className="truncate opacity-70 text-[10px]">
                              {STATUS_LABEL[c.status]}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modalAberto && (
        <ConsultaModal
          consulta={consultaSel}
          slot={slotSel}
          profissionais={profsExibidos.length > 0 ? profsExibidos : profissionais}
          pacientes={pacientes}
          servicos={servicos}
          convenios={convenios}
          podeEditar={podeEditar}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  );
}
