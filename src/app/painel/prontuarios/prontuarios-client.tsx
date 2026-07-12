"use client";

// Porta de reference/base44 src/pages/Prontuarios.jsx (índice/busca).
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, BookOpenCheck } from "lucide-react";

import { Input } from "@/components/ui/input";

type Paciente = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  data_nascimento: string | null;
};

function idade(iso: string | null): number | null {
  if (!iso) return null;
  const nasc = new Date(iso);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return anos;
}

export function ProntuariosClient({
  pacientes,
  termoPlural,
  termoPaciente,
}: {
  pacientes: Paciente[];
  termoPlural: string;
  termoPaciente: string;
}) {
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(
    () =>
      pacientes.filter(
        (p) =>
          p.nome.toLowerCase().includes(busca.toLowerCase()) ||
          p.cpf?.includes(busca) ||
          p.telefone?.includes(busca)
      ),
    [pacientes, busca]
  );

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BookOpenCheck className="w-6 h-6" /> Prontuários
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {pacientes.length} {termoPlural.toLowerCase()}(s) na clínica
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, CPF ou telefone..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtrados.length === 0 ? (
          <p className="col-span-3 text-center py-12 text-muted-foreground">
            Nenhum {termoPaciente.toLowerCase()} encontrado.
          </p>
        ) : (
          filtrados.map((p) => {
            const a = idade(p.data_nascimento);
            return (
              <Link
                key={p.id}
                href={`/painel/prontuarios/${p.id}`}
                className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                  {p.nome[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {[p.cpf, a ? `${a} anos` : null, p.telefone]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
