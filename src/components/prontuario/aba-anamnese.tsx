"use client";

// Porta de reference/base44 src/components/anamnese/AbaAnamnese.jsx +
// src/components/pacientes/AbaAnamnesePaciente.jsx (consolidadas). A lista é a
// mesma; a seção "Enviar formulário" (gerar link) só aparece no prontuário e sob
// RBAC. O link público é ${origin}/anamnese/${token}; o token vem do banco via
// gerarLinkAnamnese (Server Action). Preenchimento é pela Edge Function.
import { useState, useTransition } from "react";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Link2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";

import { gerarLinkAnamnese } from "@/lib/actions/anamnese";
import { Button } from "@/components/ui/button";

export type RespostaAnamneseLinha = {
  id: string;
  status: "pendente" | "preenchido";
  token: string;
  data_preenchimento: string | null;
  respostas: { pergunta_texto?: string; resposta?: string }[] | null;
  formulario_nome: string | null;
};

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AbaAnamnese({
  pacienteId,
  respostas,
  formulariosAtivos,
  podeEnviar,
}: {
  pacienteId: string;
  respostas: RespostaAnamneseLinha[];
  formulariosAtivos: { id: string; nome: string }[];
  podeEnviar: boolean;
}) {
  const [formularioId, setFormularioId] = useState("");
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [gerando, startTransition] = useTransition();

  function gerar() {
    setErro(null);
    setLinkGerado(null);
    startTransition(async () => {
      const r = await gerarLinkAnamnese({ paciente_id: pacienteId, formulario_id: formularioId });
      if (r.erro || !r.token) {
        setErro(r.erro ?? "Falha ao gerar link.");
        return;
      }
      setLinkGerado(`${window.location.origin}/anamnese/${r.token}`);
    });
  }

  async function copiar(texto: string, chave: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      /* clipboard indisponível */
    }
  }

  return (
    <div className="space-y-5">
      {podeEnviar && (
        <div className="border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Send className="w-4 h-4" /> Enviar formulário de anamnese
          </h3>
          {formulariosAtivos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum formulário ativo. Crie um em <span className="font-medium">Anamnese</span> no menu.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm flex-1 min-w-[180px]"
                value={formularioId}
                onChange={(e) => setFormularioId(e.target.value)}
              >
                <option value="">— Selecionar formulário —</option>
                {formulariosAtivos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
              <Button size="sm" className="gap-1.5" disabled={!formularioId || gerando} onClick={gerar}>
                <Link2 className="w-3.5 h-3.5" /> {gerando ? "Gerando..." : "Gerar link"}
              </Button>
            </div>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          {linkGerado && (
            <div className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
              <code className="text-xs flex-1 truncate">{linkGerado}</code>
              <button
                onClick={() => copiar(linkGerado, "novo")}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                {copiado === "novo" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}

      {respostas.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma ficha enviada ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {respostas.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                {r.status === "preenchido" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.formulario_nome ?? "Formulário"}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.status === "preenchido" && r.data_preenchimento
                      ? `Preenchido em ${fmtDataHora(r.data_preenchimento)}`
                      : "Aguardando preenchimento"}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {r.status === "pendente" && (
                    <button
                      onClick={() =>
                        copiar(`${window.location.origin}/anamnese/${r.token}`, r.id)
                      }
                      className="text-muted-foreground hover:text-foreground p-1"
                      title="Copiar link"
                    >
                      {copiado === r.id ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  {r.status === "preenchido" && (
                    <button
                      onClick={() => setExpandido(expandido === r.id ? null : r.id)}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      {expandido === r.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {expandido === r.id && r.status === "preenchido" && (
                <div className="border-t border-border p-4 space-y-2 bg-muted/10">
                  {(r.respostas ?? []).map((resp, i) => (
                    <div key={i} className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-medium">{resp.pergunta_texto}</p>
                      {resp.resposta?.trim() ? (
                        <p className="text-sm whitespace-pre-wrap">{resp.resposta}</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">Não respondida</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
