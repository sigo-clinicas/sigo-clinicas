"use client";

// Porta de reference/base44 src/components/prontuario/AbaDocumentos.jsx.
// Diferenças: arquivo/assinatura vão para o bucket PRIVADO `documentos`
// (path, não URL); IP da assinatura capturado no SERVIDOR (inet, não
// window.location.hostname); SEM delete (documento de consentimento é retido —
// retention-lock S2-0; remoção só via RPC auditada no S2-5).
import { useRef, useState, useTransition } from "react";
import { Plus, FileText, Pencil, CheckCircle, Clock, XCircle, Upload, Download } from "lucide-react";

import {
  assinarDocumento,
  salvarDocumento,
  type DocumentoInput,
} from "@/lib/actions/prontuario";
import { urlAssinada } from "@/lib/storage";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DocumentoLinha = {
  id: string;
  tipo: DocumentoInput["tipo"];
  titulo: string;
  conteudo: string | null;
  status: "pendente" | "assinado" | "recusado" | "revogado";
  data_assinatura: string | null;
  arquivo_path: string | null;
  assinatura_path: string | null;
  observacoes: string | null;
  created_at: string;
};

const TIPO_LABEL: Record<string, string> = {
  tcle: "TCLE",
  uso_imagem: "Uso de Imagem",
  atestado: "Atestado",
  solicitacao: "Solicitação",
  declaracao: "Declaração",
  outro: "Outro",
};
const STATUS_CFG: Record<string, { label: string; cor: string; Icon: typeof Clock }> = {
  pendente: { label: "Pendente", cor: "bg-yellow-100 text-yellow-700", Icon: Clock },
  assinado: { label: "Assinado", cor: "bg-green-100 text-green-600", Icon: CheckCircle },
  recusado: { label: "Recusado", cor: "bg-red-100 text-red-600", Icon: XCircle },
  revogado: { label: "Revogado", cor: "bg-gray-100 text-gray-600", Icon: XCircle },
};

const TEMPLATES: Record<string, { titulo: string; conteudo: string }> = {
  tcle: {
    titulo: "Termo de Consentimento Livre e Esclarecido",
    conteudo: `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)

Eu, abaixo assinado(a), declaro que fui devidamente informado(a) sobre o procedimento a ser realizado, seus riscos, benefícios e alternativas disponíveis.

Declaro ainda que:
- Todas as minhas dúvidas foram esclarecidas pelo profissional responsável;
- Estou ciente dos riscos e possíveis complicações inerentes ao procedimento;
- Autorizo a realização do procedimento descrito pelo profissional.

Em conformidade com a Resolução CFM nº 1.931/2009 e demais normativas.`,
  },
  uso_imagem: {
    titulo: "Autorização de Uso de Imagem",
    conteudo: `AUTORIZAÇÃO DE USO DE IMAGEM

Autorizo o uso de minhas imagens (fotos e/ou vídeos) para fins de acompanhamento clínico.
- Uso para fins clínicos internos;
- Divulgação externa (marketing) apenas com autorização expressa adicional;
- Identidade preservada conforme a LGPD.`,
  },
  atestado: { titulo: "Atestado Médico", conteudo: "ATESTADO MÉDICO\n\nAtesto para os devidos fins que o(a) paciente esteve sob meus cuidados..." },
  solicitacao: { titulo: "Solicitação de Exame / Encaminhamento", conteudo: "SOLICITAÇÃO DE EXAME / ENCAMINHAMENTO\n\nSolicito:\n" },
  declaracao: { titulo: "Declaração de Comparecimento", conteudo: "DECLARAÇÃO DE COMPARECIMENTO\n\nDeclaro que o(a) paciente compareceu a esta clínica..." },
};

function fmtDataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AbaDocumentos({
  clinicaId,
  pacienteId,
  documentos,
  podeEditar,
}: {
  clinicaId: string;
  pacienteId: string;
  documentos: DocumentoLinha[];
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState<DocumentoLinha | "novo" | null>(null);
  const [assinando, setAssinando] = useState<DocumentoLinha | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  async function baixarArquivo(bucket: "documentos", path: string) {
    const url = await urlAssinada(bucket, path);
    if (url) window.open(url, "_blank");
  }

  async function uploadExterno(file: File) {
    setEnviando(true);
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${clinicaId}/documentos/${pacienteId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createBrowserSupabase();
    const { error } = await supabase.storage.from("documentos").upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
    if (!error) {
      await salvarDocumento({
        paciente_id: pacienteId,
        tipo: "outro",
        titulo: file.name,
        observacoes: `Arquivo enviado via upload — ${file.name}`,
        arquivo_path: path,
      });
    }
    setEnviando(false);
  }

  if (editando !== null) {
    return (
      <FormDocumento
        pacienteId={pacienteId}
        doc={editando === "novo" ? null : editando}
        onClose={() => setEditando(null)}
      />
    );
  }

  if (assinando !== null) {
    return (
      <TelaAssinatura
        clinicaId={clinicaId}
        pacienteId={pacienteId}
        doc={assinando}
        onClose={() => setAssinando(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{documentos.length} documento(s)</p>
        {podeEditar && (
          <div className="flex gap-2 flex-wrap">
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent">
                <Upload className="w-3.5 h-3.5" />
                {enviando ? "Enviando..." : "Upload de Arquivo"}
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                className="hidden"
                disabled={enviando}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) startTransition(() => void uploadExterno(f));
                }}
              />
            </label>
            <Button size="sm" className="gap-1.5" onClick={() => setEditando("novo")}>
              <Plus className="w-3.5 h-3.5" /> Novo Documento
            </Button>
          </div>
        )}
      </div>

      {documentos.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum documento registrado.</p>
          <p className="text-xs mt-1">Adicione TCLEs e autorizações</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documentos.map((doc) => {
            const sc = STATUS_CFG[doc.status] ?? STATUS_CFG.pendente;
            return (
              <div key={doc.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{doc.titulo}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                      {TIPO_LABEL[doc.tipo] ?? doc.tipo}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${sc.cor}`}>
                      <sc.Icon className="w-3 h-3" /> {sc.label}
                    </span>
                  </div>
                  {doc.data_assinatura && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Assinado em {fmtDataHora(doc.data_assinatura)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {podeEditar && doc.status === "pendente" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAssinando(doc)}>
                      <CheckCircle className="w-3 h-3" /> Assinar
                    </Button>
                  )}
                  {doc.arquivo_path && (
                    <button
                      onClick={() => baixarArquivo("documentos", doc.arquivo_path!)}
                      className="text-muted-foreground hover:text-primary p-1"
                      title="Abrir arquivo"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {podeEditar && doc.status === "pendente" && !doc.arquivo_path && (
                    <button onClick={() => setEditando(doc)} className="text-muted-foreground hover:text-foreground p-1">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormDocumento({
  pacienteId,
  doc,
  onClose,
}: {
  pacienteId: string;
  doc: DocumentoLinha | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DocumentoInput>({
    id: doc?.id,
    paciente_id: pacienteId,
    tipo: doc?.tipo ?? "tcle",
    titulo: doc?.titulo ?? TEMPLATES.tcle.titulo,
    conteudo: doc?.conteudo ?? TEMPLATES.tcle.conteudo,
    observacoes: doc?.observacoes ?? "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function aplicarTipo(tipo: DocumentoInput["tipo"]) {
    const tpl = TEMPLATES[tipo];
    setForm((f) => ({
      ...f,
      tipo,
      titulo: tpl ? tpl.titulo : f.titulo,
      conteudo: tpl ? tpl.conteudo : f.conteudo,
    }));
  }

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
        ← Voltar
      </button>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={form.tipo}
            onChange={(e) => aplicarTipo(e.target.value as DocumentoInput["tipo"])}
          >
            <option value="tcle">TCLE — Consentimento</option>
            <option value="uso_imagem">Autorização de Uso de Imagem</option>
            <option value="atestado">Atestado Médico</option>
            <option value="solicitacao">Solicitação / Encaminhamento</option>
            <option value="declaracao">Declaração de Comparecimento</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Título *</Label>
          <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Conteúdo do Documento</Label>
        <textarea
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
          style={{ minHeight: "14rem" }}
          value={form.conteudo ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Observações</Label>
        <Input value={form.observacoes ?? ""} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          size="sm"
          disabled={salvando}
          onClick={() =>
            startTransition(async () => {
              const r = await salvarDocumento(form);
              if (r.erro) setErro(r.erro);
              else onClose();
            })
          }
        >
          {salvando ? "Salvando..." : "Salvar Documento"}
        </Button>
      </div>
    </div>
  );
}

function TelaAssinatura({
  clinicaId,
  pacienteId,
  doc,
  onClose,
}: {
  clinicaId: string;
  pacienteId: string;
  doc: DocumentoLinha;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function pos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function inicio(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const p = pos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setDesenhando(true);
    setTemAssinatura(true);
  }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!desenhando) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const p = pos(e, canvas);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function limpar() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setTemAssinatura(false);
  }

  function confirmar() {
    if (!temAssinatura) {
      setErro("Assine o documento.");
      return;
    }
    startTransition(async () => {
      const canvas = canvasRef.current!;
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) {
        setErro("Falha ao gerar a assinatura.");
        return;
      }
      const path = `${clinicaId}/assinaturas/${pacienteId}/${doc.id}.png`;
      const supabase = createBrowserSupabase();
      const up = await supabase.storage.from("documentos").upload(path, blob, {
        contentType: "image/png",
        upsert: true,
      });
      if (up.error) {
        setErro("Falha ao enviar a assinatura.");
        return;
      }
      const r = await assinarDocumento({ documentoId: doc.id, pacienteId, assinaturaPath: path });
      if (r.erro) setErro(r.erro);
      else onClose();
    });
  }

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
        ← Voltar
      </button>
      <div className="bg-muted/20 border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-2">{doc.titulo}</h3>
        <div className="text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto bg-background border border-border rounded-lg p-3 text-xs font-mono">
          {doc.conteudo || "Sem conteúdo definido."}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Assinatura do Paciente</Label>
          <button onClick={limpar} className="text-xs text-muted-foreground hover:text-foreground">
            Limpar
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={500}
          height={150}
          className="w-full border-2 border-dashed border-border rounded-xl bg-white cursor-crosshair touch-none"
          style={{ maxHeight: "150px" }}
          onMouseDown={inicio}
          onMouseMove={move}
          onMouseUp={() => setDesenhando(false)}
          onMouseLeave={() => setDesenhando(false)}
          onTouchStart={inicio}
          onTouchMove={move}
          onTouchEnd={() => setDesenhando(false)}
        />
        <p className="text-xs text-muted-foreground">Assine acima com o dedo ou mouse (IP registrado no servidor)</p>
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" disabled={salvando || !temAssinatura} onClick={confirmar}>
          {salvando ? "Salvando..." : "Confirmar Assinatura"}
        </Button>
      </div>
    </div>
  );
}
