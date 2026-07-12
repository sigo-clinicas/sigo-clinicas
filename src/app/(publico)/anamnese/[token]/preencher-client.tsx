"use client";

// Client de preenchimento público (porta PreencherAnamnese.jsx). Renderiza por
// tipo de pergunta e envia via Server Action (enviarRespostaAnamnese) que
// encaminha à Edge Function — nunca chama supabase-js no browser. A validação de
// obrigatórias é revalidada no servidor (a Edge é a linha de defesa, A2).
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { enviarRespostaAnamnese, type Pergunta } from "@/lib/actions/anamnese";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PreencherAnamnese({
  token,
  nome,
  descricao,
  pacienteNome,
  perguntas,
}: {
  token: string;
  nome: string;
  descricao: string | null;
  pacienteNome: string | null;
  perguntas: Pergunta[];
}) {
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [faltando, setFaltando] = useState<Set<string>>(new Set());
  const [concluido, setConcluido] = useState(false);
  const [enviando, startTransition] = useTransition();

  function set(id: string, v: string) {
    setRespostas((r) => ({ ...r, [id]: v }));
  }

  function enviar() {
    setErro(null);
    const falta = new Set<string>();
    for (const p of perguntas) {
      if (p.obrigatoria && !(respostas[p.id] ?? "").trim()) falta.add(p.id);
    }
    if (falta.size > 0) {
      setFaltando(falta);
      setErro("Preencha os campos obrigatórios destacados.");
      return;
    }
    setFaltando(new Set());
    // snapshot COMPLETO — uma entrada por pergunta (inclusive vazias)
    const payload = perguntas.map((p) => ({
      pergunta_id: p.id,
      pergunta_texto: p.texto,
      resposta: respostas[p.id] ?? "",
    }));
    startTransition(async () => {
      const r = await enviarRespostaAnamnese({ token, respostas: payload });
      if (r.ok) setConcluido(true);
      else setErro(r.erro);
    });
  }

  if (concluido) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
        <h1 className="text-lg font-semibold">Anamnese enviada!</h1>
        <p className="text-sm text-muted-foreground mt-1">Obrigado. Você já pode fechar esta página.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-5 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold">{nome}</h1>
          {descricao && <p className="text-sm text-muted-foreground mt-0.5">{descricao}</p>}
          {pacienteNome && (
            <p className="text-xs text-muted-foreground mt-2">Paciente: {pacienteNome}</p>
          )}
        </div>

        <div className="space-y-4">
          {perguntas.map((p, i) => (
            <div key={p.id} className="space-y-1.5">
              <Label className="text-sm">
                {i + 1}. {p.texto}
                {p.obrigatoria && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <Campo
                pergunta={p}
                valor={respostas[p.id] ?? ""}
                onChange={(v) => set(p.id, v)}
                erro={faltando.has(p.id)}
              />
            </div>
          ))}
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <Button className="w-full gap-2" onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {enviando ? "Enviando..." : "Enviar Anamnese"}
        </Button>
      </div>
    </div>
  );
}

function Campo({
  pergunta,
  valor,
  onChange,
  erro,
}: {
  pergunta: Pergunta;
  valor: string;
  onChange: (v: string) => void;
  erro: boolean;
}) {
  const borda = erro ? "border-destructive" : "";
  switch (pergunta.tipo) {
    case "texto_longo":
      return (
        <textarea
          className={`w-full rounded-md border border-input ${borda} bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`}
          rows={3}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "numero":
      return <Input type="number" className={borda} value={valor} onChange={(e) => onChange(e.target.value)} />;
    case "sim_nao":
      return (
        <div className="flex gap-2">
          {["Sim", "Não"].map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => onChange(op)}
              className={`flex-1 h-9 rounded-md border text-sm transition-colors ${
                valor === op
                  ? "bg-primary text-primary-foreground border-primary"
                  : `border-input ${borda} hover:bg-muted`
              }`}
            >
              {op}
            </button>
          ))}
        </div>
      );
    case "multipla_escolha":
      return (
        <div className="space-y-1.5">
          {pergunta.opcoes.map((op) => (
            <label key={op} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={pergunta.id}
                checked={valor === op}
                onChange={() => onChange(op)}
              />
              {op}
            </label>
          ))}
        </div>
      );
    default:
      return <Input type="text" className={borda} value={valor} onChange={(e) => onChange(e.target.value)} />;
  }
}
