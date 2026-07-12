"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, Download, Trash2, CheckCircle2 } from "lucide-react";

import { anonimizarPaciente } from "@/lib/actions/lgpd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SolicitacaoLinha = {
  id: string;
  tipo: "exportacao" | "exclusao";
  detalhe: string | null;
  created_at: string;
  pacienteId: string;
  pacienteNome: string;
  anonimizado: boolean;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LgpdAdminClient({ solicitacoes }: { solicitacoes: SolicitacaoLinha[] }) {
  const [pacienteId, setPacienteId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, startTransition] = useTransition();

  function anonimizar(pid: string, mot: string) {
    if (!pid.trim() || !mot.trim()) {
      setErro("Informe o ID do paciente e o motivo/base legal.");
      return;
    }
    if (!confirm("Anonimizar é IRREVERSÍVEL: apaga os identificadores do paciente e encerra o acesso. Continuar?")) {
      return;
    }
    setErro(null);
    setMsg(null);
    startTransition(async () => {
      const r = await anonimizarPaciente({ pacienteId: pid, motivo: mot });
      if (r.erro) setErro(r.erro);
      else setMsg(`Paciente anonimizado. Objetos de storage removidos: ${r.objetosRemovidos ?? 0}.`);
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" /> LGPD — Titulares
        </h1>
        <p className="text-sm text-muted-foreground">
          Pedidos dos titulares (art. 18) e anonimização (art. 16). O prontuário é
          <strong> retido </strong> por lei; a anonimização apaga só os identificadores diretos.
          Purga automática por prazo não está ligada (prazos pendentes da cliente).
        </p>
      </div>

      {msg && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4" /> {msg}
        </div>
      )}
      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Pedidos abertos pelos titulares</h2>
        {solicitacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-6 text-center">
            Nenhum pedido self-service registrado.
          </p>
        ) : (
          <div className="space-y-2">
            {solicitacoes.map((s) => (
              <div key={s.id} className="border border-border rounded-xl p-4 flex items-center gap-3">
                {s.tipo === "exportacao" ? (
                  <Download className="w-4 h-4 text-blue-500 shrink-0" />
                ) : (
                  <Trash2 className="w-4 h-4 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {s.tipo === "exportacao" ? "Exportação de dados" : "Exclusão / anonimização"} —{" "}
                    {s.pacienteNome}
                    {s.anonimizado && <span className="ml-2 text-xs text-emerald-600">(já anonimizado)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(s.created_at)}
                    {s.detalhe ? ` · ${s.detalhe}` : ""}
                  </p>
                </div>
                {s.tipo === "exclusao" && !s.anonimizado && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={processando}
                    onClick={() => anonimizar(s.pacienteId, `Pedido self-service ${s.id}`)}
                  >
                    Anonimizar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-5">
        <h2 className="text-sm font-semibold">Anonimização manual</h2>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label className="text-xs">ID do paciente</Label>
            <Input value={pacienteId} onChange={(e) => setPacienteId(e.target.value)} placeholder="uuid do paciente" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo / base legal</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: pedido de exclusão do titular (art. 18)" />
          </div>
          <div>
            <Button variant="destructive" disabled={processando} onClick={() => anonimizar(pacienteId, motivo)}>
              {processando ? "Processando..." : "Anonimizar paciente"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
