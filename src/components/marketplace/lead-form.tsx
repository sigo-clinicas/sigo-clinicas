"use client";

// S3-8 — Captação de lead (nome+telefone, sem login) → POST /api/publico/lead
// (service_role no servidor grava com origem/clinica corretos).
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LeadForm({
  origem = "marketplace",
  clinicaId,
  cupomId,
}: {
  origem?: "marketplace" | "cupom" | "lista_vip";
  clinicaId?: string;
  cupomId?: string;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      const resp = await fetch("/api/publico/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone, origem, clinica_id: clinicaId, cupom_id: cupomId }),
      });
      if (!resp.ok) {
        const j = await resp.json();
        setErro(j.erro ?? "Não foi possível enviar.");
      } else setOk(true);
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return <p className="text-sm text-green-600">Recebemos seu contato! Em breve retornaremos.</p>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Input
        placeholder="Seu telefone"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
      />
      <Button onClick={enviar} disabled={enviando || !nome.trim() || !telefone.trim()}>
        {enviando ? "Enviando..." : "Quero contato"}
      </Button>
      {erro && <p className="text-destructive self-center text-sm">{erro}</p>}
    </div>
  );
}
