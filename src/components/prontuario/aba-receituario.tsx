"use client";

// Porta de reference/base44 src/components/prontuario/AbaReceituario.jsx.
// Receituário NÃO é tabela: é a projeção das evoluções com `prescricao`. Uma
// nova receita grava uma evolução (descrição "Receituário Digital" + prescrição)
// via salvarEvolucao. Impressão com white-label da clínica + conselho/registro
// do profissional (nome_conselho/numero_registro).
import { useState, useTransition } from "react";
import { Printer, Pill, Plus, FileSignature, ShieldCheck } from "lucide-react";

import { salvarEvolucao, type EvolucaoInput } from "@/lib/actions/prontuario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EvolucaoLinha } from "./aba-evolucao";

export type ProfissionalReceita = {
  id: string;
  nome: string;
  nome_conselho: string | null;
  numero_registro: string | null;
};

function fmtData(iso: string): string {
  const [a, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${a}`;
}

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function imprimirReceita(
  rec: { data: string; prescricao: string; orientacoes_pos: string | null },
  paciente: string,
  prof: ProfissionalReceita | null,
  clinicaNome: string
) {
  const win = window.open("", "_blank");
  if (!win) return;
  const conselho =
    prof?.nome_conselho && prof?.numero_registro
      ? `${esc(prof.nome_conselho)}: ${esc(prof.numero_registro)}`
      : "";
  win.document.write(`<html><head><title>Receituário — ${esc(paciente)}</title><style>
    body{font-family:Arial,sans-serif;font-size:13px;color:#111;margin:0}
    .page{max-width:800px;margin:0 auto;padding:40px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a365d;padding-bottom:16px;margin-bottom:24px}
    .clinic-info h1{font-size:18px;color:#1a365d;margin:0 0 4px} .clinic-info p{font-size:11px;color:#555;margin:2px 0}
    .doc-title{text-align:right} .doc-title h2{font-size:16px;color:#1a365d;margin:0 0 4px}
    .badge{display:inline-block;background:#e8f4f8;color:#1a365d;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:bold;border:1px solid #bee3f8}
    .patient-box{background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
    .field label{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#718096;display:block} .field span{font-size:12px;font-weight:600}
    .section-title{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;color:#4a5568;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:20px 0 10px}
    .prescricao-box{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:13px;line-height:1.8;white-space:pre-wrap;min-height:120px}
    .orientacoes{font-size:12px;line-height:1.6;color:#4a5568;white-space:pre-wrap}
    .signature-area{margin-top:60px;display:flex;justify-content:flex-end} .signature-block{width:260px;text-align:center}
    .signature-line{border-top:1px solid #333;padding-top:8px;margin-top:50px} .signature-name{font-size:12px;font-weight:bold} .signature-crm{font-size:10px;color:#718096}
    .icp-notice{margin-top:30px;padding:10px 14px;background:#f0fff4;border:1px solid #9ae6b4;border-radius:6px;font-size:10px;color:#276749}
    .footer{margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#a0aec0;text-align:center}
    @media print{body{margin:0}.page{padding:20px}}</style></head><body><div class="page">
    <div class="header"><div class="clinic-info"><h1>${esc(clinicaNome)}</h1>
    <p>Receituário digital — validade jurídica mediante assinatura eletrônica</p></div>
    <div class="doc-title"><h2>RECEITUÁRIO</h2><span class="badge">Documento Clínico Oficial</span></div></div>
    <div class="patient-box"><div class="field"><label>Paciente</label><span>${esc(paciente)}</span></div>
    <div class="field"><label>Data</label><span>${esc(fmtData(rec.data))}</span></div>
    <div class="field"><label>Profissional</label><span>${esc(prof?.nome ?? "—")}</span></div></div>
    <div class="section-title">Prescrição</div><div class="prescricao-box">${esc(rec.prescricao)}</div>
    ${rec.orientacoes_pos ? `<div class="section-title">Orientações ao Paciente</div><div class="orientacoes">${esc(rec.orientacoes_pos)}</div>` : ""}
    <div class="signature-area"><div class="signature-block"><div class="signature-line">
    <div class="signature-name">${esc(prof?.nome ?? "Profissional")}</div>
    ${conselho ? `<div class="signature-crm">${conselho}</div>` : ""}</div></div></div>
    <div class="icp-notice"><strong>⚡ Receituário Digital — Padrão ICP-Brasil</strong>
    Documento válido nos termos da Lei nº 14.063/2020. Para validade jurídica plena, assine
    digitalmente com certificado ICP-Brasil (Gov.br, BirdID, SafeSign etc.).</div>
    <div class="footer">Gerado em ${esc(new Date().toLocaleString("pt-BR"))} · Sigo Clínicas</div>
    </div></body></html>`);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}

export function AbaReceituario({
  pacienteId,
  pacienteNome,
  clinicaNome,
  evolucoes,
  profissionais,
  podeEditar,
}: {
  pacienteId: string;
  pacienteNome: string;
  clinicaNome: string;
  evolucoes: EvolucaoLinha[];
  profissionais: ProfissionalReceita[];
  podeEditar: boolean;
}) {
  const [nova, setNova] = useState(false);
  const receitas = evolucoes.filter((e) => e.prescricao && e.prescricao.trim());

  if (nova) {
    return (
      <NovaReceita
        pacienteId={pacienteId}
        pacienteNome={pacienteNome}
        clinicaNome={clinicaNome}
        profissionais={profissionais}
        onClose={() => setNova(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Receituário Digital</h2>
          <p className="text-xs text-muted-foreground">
            Emissão de receitas com suporte a assinatura eletrônica (ICP-Brasil)
          </p>
        </div>
        {podeEditar && (
          <Button size="sm" className="gap-1.5" onClick={() => setNova(true)}>
            <Plus className="w-3.5 h-3.5" /> Nova Receita
          </Button>
        )}
      </div>

      <div className="flex items-start gap-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-xl p-3">
        <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
        <div className="text-xs text-green-800 dark:text-green-300">
          <p className="font-semibold">Receituário Digital com padrão ICP-Brasil</p>
          <p className="mt-0.5">
            Os documentos seguem o modelo da Lei nº 14.063/2020. Para validade jurídica plena, assine
            digitalmente com certificado ICP-Brasil.
          </p>
        </div>
      </div>

      {receitas.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
          <Pill className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum receituário registrado.</p>
          <p className="text-xs mt-1">Prescrições feitas na Evolução aparecem aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {receitas.map((rec) => {
            const prof = profissionais.find((p) => p.id === rec.profissional_id) ?? null;
            return (
              <div key={rec.id} className="border border-border rounded-xl overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">
                        {fmtData(rec.data_hora)}
                        {rec.numero_sessao ? ` · Sessão ${rec.numero_sessao}` : ""}
                      </p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        Emitido
                      </span>
                    </div>
                    {prof && <p className="text-xs text-muted-foreground mt-0.5">{prof.nome}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0"
                    onClick={() =>
                      imprimirReceita(
                        { data: rec.data_hora, prescricao: rec.prescricao ?? "", orientacoes_pos: rec.orientacoes_pos },
                        pacienteNome,
                        prof,
                        clinicaNome
                      )
                    }
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir
                  </Button>
                </div>
                <div className="border-t border-border bg-blue-50 dark:bg-blue-900/10 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">
                    Prescrição
                  </p>
                  <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">{rec.prescricao}</p>
                </div>
                {rec.orientacoes_pos && (
                  <div className="border-t border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                      Orientações
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{rec.orientacoes_pos}</p>
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

function NovaReceita({
  pacienteId,
  pacienteNome,
  clinicaNome,
  profissionais,
  onClose,
}: {
  pacienteId: string;
  pacienteNome: string;
  clinicaNome: string;
  profissionais: ProfissionalReceita[];
  onClose: () => void;
}) {
  const [profissionalId, setProfissionalId] = useState("");
  const [prescricao, setPrescricao] = useState("");
  const [orientacoes, setOrientacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function salvar(imprimir: boolean) {
    if (!prescricao.trim()) {
      setErro("A prescrição é obrigatória.");
      return;
    }
    const payload: EvolucaoInput = {
      paciente_id: pacienteId,
      profissional_id: profissionalId || null,
      data_hora: new Date().toISOString(),
      descricao_atendimento: "Receituário Digital",
      prescricao,
      orientacoes_pos: orientacoes || null,
      fotos: [],
      insumos: [],
      baixarInsumos: false,
    };
    startTransition(async () => {
      const r = await salvarEvolucao(payload);
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      if (imprimir) {
        const prof = profissionais.find((p) => p.id === profissionalId) ?? null;
        imprimirReceita(
          { data: new Date().toISOString(), prescricao, orientacoes_pos: orientacoes || null },
          pacienteNome,
          prof,
          clinicaNome
        );
      }
      onClose();
    });
  }

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
        ← Voltar
      </button>
      <div className="flex items-center gap-2">
        <FileSignature className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Nova Receita Digital</h2>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Profissional Prescritor</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          value={profissionalId}
          onChange={(e) => setProfissionalId(e.target.value)}
        >
          <option value="">— Selecionar —</option>
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
              {p.nome_conselho && p.numero_registro ? ` (${p.nome_conselho}: ${p.numero_registro})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Prescrição *</Label>
        <textarea
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
          style={{ minHeight: "160px" }}
          value={prescricao}
          onChange={(e) => setPrescricao(e.target.value)}
          placeholder={"Ex:\n1. Amoxicilina 500mg — 1 cápsula de 8/8h por 7 dias.\n\nUso: Oral"}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Orientações ao Paciente</Label>
        <textarea
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          style={{ minHeight: "80px" }}
          value={orientacoes}
          onChange={(e) => setOrientacoes(e.target.value)}
        />
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="outline" size="sm" disabled={salvando} onClick={() => salvar(false)}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
        <Button size="sm" className="gap-1.5" disabled={salvando} onClick={() => salvar(true)}>
          <Printer className="w-3.5 h-3.5" />
          {salvando ? "Salvando..." : "Salvar e Imprimir"}
        </Button>
      </div>
    </div>
  );
}
