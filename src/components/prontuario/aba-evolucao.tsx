"use client";

// Porta de reference/base44 src/components/prontuario/AbaEvolucao.jsx.
// Mudanças estruturais do stack novo:
//  - insumos_utilizados[] (array embutido no Base44) → tabela evolucao_insumo;
//  - fotos vão para o bucket PRIVADO `prontuario` (path por clínica, signed URL);
//  - baixa de estoque é a RPC baixar_insumos_evolucao (ponte de papel D4);
//  - próxima sessão sugerida vira consulta de retorno via RPC (D5);
//  - botão de microfone é o gancho de voz (D3, ainda sem ASR).
import { useState, useTransition } from "react";
import {
  Plus,
  Activity,
  Pencil,
  ChevronDown,
  ChevronUp,
  Camera,
  X,
  AlertTriangle,
  Printer,
  Loader2,
  PackageMinus,
} from "lucide-react";

import {
  salvarEvolucao,
  removerInsumoEvolucao,
  type EvolucaoInput,
  type InsumoEvolucaoInput,
  type FotoProntuario,
} from "@/lib/actions/prontuario";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FotoThumb } from "./foto-thumb";
import { BotaoVoz } from "./botao-voz";

export type InsumoLinha = {
  id: string;
  produto_nome: string;
  fabricante: string | null;
  quantidade: string | null;
  lote: string | null;
  validade: string | null;
  item_estoque_id: string | null;
  movimentacao_estoque_id: string | null;
};

export type EvolucaoLinha = {
  id: string;
  data_hora: string;
  profissional_id: string | null;
  consulta_id: string | null;
  numero_sessao: number | null;
  descricao_atendimento: string | null;
  reacao_paciente: string | null;
  intercorrencias: string | null;
  orientacoes_pos: string | null;
  prescricao: string | null;
  proxima_sessao_sugerida: string | null;
  fotos: FotoProntuario[] | null;
  insumos: InsumoLinha[];
};

export type ItemEstoqueOpcao = { id: string; descricao: string; unidade: string | null };
export type ConsultaConcluida = { id: string; data_hora: string; profissional_id: string };

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Conteúdo clínico é texto livre digitado por staff; escapa antes de injetar na
// janela de impressão (fecha XSS armazenado via document.write).
function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function imprimirEvolucao(ev: EvolucaoLinha, pacienteNome: string, profNome: string | null) {
  const win = window.open("", "_blank");
  if (!win) return;
  const linha = (t: string, c: string | null) =>
    c ? `<div class="section"><h2>${t}</h2><div class="content">${esc(c)}</div></div>` : "";
  const insumos =
    ev.insumos.length > 0
      ? `<div class="section"><h2>Rastreabilidade de Insumos</h2>${ev.insumos
          .map(
            (i) =>
              `<div style="font-size:10px;margin:4px 0"><b>${esc(i.produto_nome)}</b>${
                i.fabricante ? " · " + esc(i.fabricante) : ""
              }${i.lote ? " · Lote: " + esc(i.lote) : ""}${i.validade ? " · Val: " + esc(i.validade) : ""}${
                i.quantidade ? " · Qtd: " + esc(i.quantidade) : ""
              }</div>`
          )
          .join("")}</div>`
      : "";
  win.document.write(`<html><head><title>Evolução — ${esc(pacienteNome)}</title><style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:40px}
    .header{border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:20px}
    h1{font-size:16px;margin:0 0 4px} .info{font-size:11px;color:#555;margin:2px 0}
    h2{font-size:12px;font-weight:bold;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:2px}
    .content{white-space:pre-wrap;font-size:11px;line-height:1.5} .section{margin:10px 0}
    @media print{body{margin:20px}}</style></head><body>
    <div class="header"><h1>Registro de Evolução Clínica</h1>
    <div class="info"><b>Paciente:</b> ${esc(pacienteNome)}</div>
    <div class="info"><b>Data:</b> ${esc(fmtDataHora(ev.data_hora))}</div>
    ${ev.numero_sessao ? `<div class="info"><b>Sessão:</b> ${ev.numero_sessao}</div>` : ""}
    ${profNome ? `<div class="info"><b>Profissional:</b> ${esc(profNome)}</div>` : ""}</div>
    ${linha("Descrição do Atendimento", ev.descricao_atendimento)}
    ${linha("Reação do Paciente", ev.reacao_paciente)}
    ${linha("⚠ Intercorrências", ev.intercorrencias)}
    ${insumos}
    ${linha("Orientações Pós-Procedimento", ev.orientacoes_pos)}
    ${linha("Prescrição", ev.prescricao)}
    </body></html>`);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}

export function AbaEvolucao({
  clinicaId,
  pacienteId,
  pacienteNome,
  evolucoes,
  profissionais,
  itensEstoque,
  consultas,
  podeEditar,
}: {
  clinicaId: string;
  pacienteId: string;
  pacienteNome: string;
  evolucoes: EvolucaoLinha[];
  profissionais: { id: string; nome: string }[];
  itensEstoque: ItemEstoqueOpcao[];
  consultas: ConsultaConcluida[];
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState<EvolucaoLinha | "nova" | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  if (editando !== null) {
    return (
      <FormEvolucao
        clinicaId={clinicaId}
        pacienteId={pacienteId}
        evolucao={editando === "nova" ? null : editando}
        numeroSessao={evolucoes.length + 1}
        profissionais={profissionais}
        itensEstoque={itensEstoque}
        consultas={consultas}
        onClose={() => setEditando(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{evolucoes.length} registro(s) de evolução</p>
        {podeEditar && (
          <Button size="sm" className="gap-1.5" onClick={() => setEditando("nova")}>
            <Plus className="w-3.5 h-3.5" /> Nova Evolução
          </Button>
        )}
      </div>

      {evolucoes.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma evolução registrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {evolucoes.map((ev, idx) => {
            const prof = profissionais.find((p) => p.id === ev.profissional_id);
            return (
              <div key={ev.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandido(expandido === ev.id ? null : ev.id)}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {ev.numero_sessao ?? evolucoes.length - idx}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{fmtDataHora(ev.data_hora)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {prof && `${prof.nome} · `}
                      {ev.descricao_atendimento?.substring(0, 60)}
                      {(ev.descricao_atendimento?.length ?? 0) > 60 ? "..." : ""}
                    </div>
                    {ev.intercorrencias && (
                      <div className="flex items-center gap-1 text-xs text-destructive mt-0.5">
                        <AlertTriangle className="w-3 h-3" /> Intercorrência registrada
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        imprimirEvolucao(ev, pacienteNome, prof?.nome ?? null);
                      }}
                      className="text-muted-foreground hover:text-primary p-1"
                      title="Imprimir evolução"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {podeEditar && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditando(ev);
                        }}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {expandido === ev.id ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expandido === ev.id && (
                  <div className="border-t border-border p-4 space-y-3 bg-muted/10">
                    {ev.descricao_atendimento && (
                      <Info label="Descrição do Atendimento" value={ev.descricao_atendimento} />
                    )}
                    {ev.reacao_paciente && <Info label="Reação do Paciente" value={ev.reacao_paciente} />}
                    {ev.intercorrencias && (
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-destructive" /> Intercorrências
                        </p>
                        <p className="text-sm text-destructive bg-destructive/5 rounded-lg p-2">
                          {ev.intercorrencias}
                        </p>
                      </div>
                    )}
                    {ev.insumos.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          Rastreabilidade de Insumos
                        </p>
                        <div className="space-y-1.5">
                          {ev.insumos.map((ins) => (
                            <div
                              key={ins.id}
                              className="text-xs bg-background border border-border rounded-lg px-3 py-2 flex items-center gap-2"
                            >
                              <span className="font-medium">{ins.produto_nome}</span>
                              {ins.fabricante && ` · ${ins.fabricante}`}
                              {ins.lote && <span className="text-muted-foreground"> · Lote: {ins.lote}</span>}
                              {ins.validade && <span className="text-muted-foreground"> · Val: {ins.validade}</span>}
                              {ins.quantidade && <span className="text-muted-foreground"> · Qtd: {ins.quantidade}</span>}
                              {ins.movimentacao_estoque_id && (
                                <span className="ml-auto inline-flex items-center gap-1 text-emerald-600">
                                  <PackageMinus className="w-3 h-3" /> baixado
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {ev.orientacoes_pos && <Info label="Orientações Pós-Procedimento" value={ev.orientacoes_pos} />}
                    {ev.prescricao && <Info label="Prescrição" value={ev.prescricao} />}
                    {Array.isArray(ev.fotos) && ev.fotos.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Fotos</p>
                        <div className="flex gap-2 flex-wrap">
                          {ev.fotos.map((f, i) => (
                            <FotoThumb key={i} path={f.path} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

type InsumoForm = InsumoEvolucaoInput;

function FormEvolucao({
  clinicaId,
  pacienteId,
  evolucao,
  numeroSessao,
  profissionais,
  itensEstoque,
  consultas,
  onClose,
}: {
  clinicaId: string;
  pacienteId: string;
  evolucao: EvolucaoLinha | null;
  numeroSessao: number;
  profissionais: { id: string; nome: string }[];
  itensEstoque: ItemEstoqueOpcao[];
  consultas: ConsultaConcluida[];
  onClose: () => void;
}) {
  const agora = new Date();
  const nowLocal = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [form, setForm] = useState({
    profissional_id: evolucao?.profissional_id ?? "",
    consulta_id: evolucao?.consulta_id ?? "",
    data_hora: evolucao ? new Date(evolucao.data_hora).toISOString().slice(0, 16) : nowLocal,
    descricao_atendimento: evolucao?.descricao_atendimento ?? "",
    reacao_paciente: evolucao?.reacao_paciente ?? "",
    intercorrencias: evolucao?.intercorrencias ?? "",
    orientacoes_pos: evolucao?.orientacoes_pos ?? "",
    prescricao: evolucao?.prescricao ?? "",
    proxima_sessao_sugerida: evolucao?.proxima_sessao_sugerida?.slice(0, 10) ?? "",
    fotos: (evolucao?.fotos ?? []) as FotoProntuario[],
  });
  // insumos já salvos (com id) + novos (sem id)
  const [insumos, setInsumos] = useState<InsumoForm[]>(
    evolucao?.insumos.map((i) => ({
      id: i.id,
      produto_nome: i.produto_nome,
      fabricante: i.fabricante,
      quantidade: i.quantidade,
      lote: i.lote,
      validade: i.validade,
      item_estoque_id: i.item_estoque_id,
    })) ?? []
  );
  const [baixados] = useState<Set<string>>(
    new Set(evolucao?.insumos.filter((i) => i.movimentacao_estoque_id).map((i) => i.id) ?? [])
  );
  const [baixarInsumos, setBaixarInsumos] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, startTransition] = useTransition();

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function addInsumo() {
    setInsumos((l) => [
      ...l,
      { produto_nome: "", fabricante: "", quantidade: "", lote: "", validade: "", item_estoque_id: null },
    ]);
  }
  function updateInsumo(idx: number, campo: keyof InsumoForm, valor: string | null) {
    setInsumos((l) => l.map((ins, i) => (i === idx ? { ...ins, [campo]: valor } : ins)));
  }
  async function removeInsumo(idx: number) {
    const ins = insumos[idx];
    if (ins.id) {
      // já salvo → remoção reverte a baixa (RPC), então persiste na hora
      const r = await removerInsumoEvolucao({ insumoId: ins.id, pacienteId });
      if (r.erro) {
        setErro(r.erro);
        return;
      }
    }
    setInsumos((l) => l.filter((_, i) => i !== idx));
  }

  async function uploadFoto(file: File) {
    setEnviandoFoto(true);
    setErro(null);
    const ext = file.name.split(".").pop() || "png";
    const path = `${clinicaId}/evolucoes/${pacienteId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createBrowserSupabase();
    const { error } = await supabase.storage.from("prontuario").upload(path, file, {
      contentType: file.type || "image/png",
    });
    setEnviandoFoto(false);
    if (error) {
      setErro("Falha ao enviar a foto.");
      return;
    }
    set("fotos", [
      ...form.fotos,
      { path, descricao: "", data: new Date().toISOString().slice(0, 10), categoria: "evolucao" },
    ]);
  }

  const temInsumoVinculado = insumos.some((i) => i.item_estoque_id && !i.id) || (baixarInsumos && insumos.some((i) => i.item_estoque_id));

  function salvar() {
    if (!form.descricao_atendimento.trim()) {
      setErro("A descrição do atendimento é obrigatória.");
      return;
    }
    const payload: EvolucaoInput = {
      id: evolucao?.id,
      paciente_id: pacienteId,
      profissional_id: form.profissional_id || null,
      consulta_id: form.consulta_id || null,
      data_hora: new Date(form.data_hora).toISOString(),
      descricao_atendimento: form.descricao_atendimento,
      reacao_paciente: form.reacao_paciente,
      intercorrencias: form.intercorrencias,
      orientacoes_pos: form.orientacoes_pos,
      prescricao: form.prescricao,
      proxima_sessao_sugerida: form.proxima_sessao_sugerida || null,
      fotos: form.fotos,
      insumos,
      baixarInsumos: baixarInsumos && insumos.some((i) => i.item_estoque_id),
    };
    startTransition(async () => {
      const r = await salvarEvolucao(payload);
      if (r.erro) setErro(r.erro);
      else onClose();
    });
  }

  return (
    <div className="space-y-5">
      <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
        ← Voltar
      </button>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Agendamento vinculado</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={form.consulta_id}
            onChange={(e) => {
              const cons = consultas.find((x) => x.id === e.target.value);
              set("consulta_id", e.target.value);
              if (cons) {
                set("data_hora", new Date(cons.data_hora).toISOString().slice(0, 16));
                set("profissional_id", cons.profissional_id);
              }
            }}
          >
            <option value="">— Nenhum —</option>
            {consultas.map((c) => (
              <option key={c.id} value={c.id}>
                {fmtDataHora(c.data_hora)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Profissional</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={form.profissional_id}
            onChange={(e) => set("profissional_id", e.target.value)}
          >
            <option value="">— Selecionar —</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Data e Hora *</Label>
          <Input
            type="datetime-local"
            value={form.data_hora}
            onChange={(e) => set("data_hora", e.target.value)}
          />
        </div>
        {!evolucao && (
          <div className="space-y-1">
            <Label className="text-xs">Nº da Sessão</Label>
            <div className="flex h-9 items-center px-3 rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
              {numeroSessao}
            </div>
          </div>
        )}
      </div>

      <Secao titulo="Registro da Sessão">
        <TextArea
          label="Descrição do Atendimento *"
          value={form.descricao_atendimento}
          onChange={(v) => set("descricao_atendimento", v)}
          rows={4}
          comVoz
        />
        <TextArea
          label="Reação do Paciente"
          value={form.reacao_paciente}
          onChange={(v) => set("reacao_paciente", v)}
        />
        <TextArea
          label="Intercorrências"
          value={form.intercorrencias}
          onChange={(v) => set("intercorrencias", v)}
        />
      </Secao>

      <Secao titulo="Rastreabilidade de Insumos">
        <div className="space-y-2">
          {insumos.map((ins, i) => {
            const jaBaixado = ins.id ? baixados.has(ins.id) : false;
            return (
              <div key={ins.id ?? `novo-${i}`} className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-lg border border-border">
                <div className="col-span-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Insumo {i + 1}
                    {jaBaixado && <span className="ml-2 text-emerald-600">· baixado do estoque</span>}
                  </span>
                  <button onClick={() => removeInsumo(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Produto / Medicamento</Label>
                  <Input
                    value={ins.produto_nome}
                    disabled={!!ins.id}
                    onChange={(e) => updateInsumo(i, "produto_nome", e.target.value)}
                    placeholder="Ex: Toxina Botulínica, Ácido Hialurônico..."
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Vincular ao estoque (habilita baixa)</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={ins.item_estoque_id ?? ""}
                    disabled={!!ins.id}
                    onChange={(e) => updateInsumo(i, "item_estoque_id", e.target.value || null)}
                  >
                    <option value="">— Não vincular —</option>
                    {itensEstoque.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.descricao}
                        {it.unidade ? ` (${it.unidade})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fabricante</Label>
                  <Input value={ins.fabricante ?? ""} disabled={!!ins.id} onChange={(e) => updateInsumo(i, "fabricante", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade</Label>
                  <Input value={ins.quantidade ?? ""} disabled={!!ins.id} onChange={(e) => updateInsumo(i, "quantidade", e.target.value)} placeholder="Ex: 50 UI, 1ml" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lote</Label>
                  <Input value={ins.lote ?? ""} disabled={!!ins.id} onChange={(e) => updateInsumo(i, "lote", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Validade</Label>
                  <Input type="date" value={ins.validade ?? ""} disabled={!!ins.id} onChange={(e) => updateInsumo(i, "validade", e.target.value)} />
                </div>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={addInsumo} className="gap-1.5 w-full">
            <Plus className="w-3.5 h-3.5" /> Adicionar Insumo
          </Button>
          {temInsumoVinculado && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <input
                type="checkbox"
                checked={baixarInsumos}
                onChange={(e) => setBaixarInsumos(e.target.checked)}
              />
              Dar baixa no estoque dos insumos vinculados ao salvar
            </label>
          )}
        </div>
      </Secao>

      <Secao titulo="Orientações e Prescrição">
        <TextArea
          label="Orientações Pós-Procedimento"
          value={form.orientacoes_pos}
          onChange={(v) => set("orientacoes_pos", v)}
        />
        <TextArea label="Prescrição (Receituário)" value={form.prescricao} onChange={(v) => set("prescricao", v)} />
        <div className="space-y-1">
          <Label className="text-xs">Próxima Sessão Sugerida (gera retorno)</Label>
          <Input
            type="date"
            value={form.proxima_sessao_sugerida}
            onChange={(e) => set("proxima_sessao_sugerida", e.target.value)}
            disabled={!!evolucao}
          />
        </div>
      </Secao>

      <Secao titulo="Fotos da Evolução">
        <div className="flex flex-wrap gap-2 items-center">
          {form.fotos.map((f, i) => (
            <div key={i} className="relative">
              <FotoThumb path={f.path} />
              <button
                onClick={() => set("fotos", form.fotos.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 text-muted-foreground">
            {enviandoFoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={enviandoFoto}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFoto(file);
              }}
            />
          </label>
        </div>
      </Secao>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar Evolução"}
        </Button>
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {children}
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  comVoz,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  comVoz?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {comVoz && <BotaoVoz />}
      </div>
      <textarea
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        style={{ minHeight: `${rows * 1.75}rem` }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
