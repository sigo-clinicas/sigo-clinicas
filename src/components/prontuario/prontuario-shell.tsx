"use client";

// Porta de reference/base44 src/pages/PacientePerfil.jsx (shell client).
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Stethoscope,
  Activity,
  FileText,
  ShoppingBag,
  Pill,
  Printer,
  Camera,
  Construction,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Terminologia, TipoClinica } from "@/lib/terminologia";
import { AbaResumo } from "./aba-resumo";
import { AbaAvaliacao, type AvaliacaoLinha } from "./aba-avaliacao";
import { AbaDocumentos, type DocumentoLinha } from "./aba-documentos";

export type PacienteProntuario = {
  id: string;
  nome: string;
  cpf: string | null;
  data_nascimento: string | null;
  sexo: "masculino" | "feminino" | "outro" | null;
  telefone: string | null;
  email: string | null;
  logradouro: string | null;
  numero_carteirinha: string | null;
  nome_mae: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  contato_emergencia_parentesco: string | null;
  observacoes: string | null;
};

function idadeDe(iso: string | null): number | null {
  if (!iso) return null;
  const nasc = new Date(iso);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return anos;
}

type TabId =
  | "resumo"
  | "avaliacao"
  | "orcamentos"
  | "evolucao"
  | "receituario"
  | "galeria"
  | "documentos"
  | "dados";

export function ProntuarioShell({
  clinicaId,
  paciente,
  convenioNome,
  profissionais,
  avaliacoes,
  documentos,
  termo,
  tipoClinica,
  podeEditar,
}: {
  clinicaId: string;
  paciente: PacienteProntuario;
  convenioNome: string | null;
  profissionais: { id: string; nome: string }[];
  avaliacoes: AvaliacaoLinha[];
  documentos: DocumentoLinha[];
  termo: Terminologia;
  tipoClinica: TipoClinica;
  podeEditar: boolean;
}) {
  const [tab, setTab] = useState<TabId>("resumo");
  const idade = idadeDe(paciente.data_nascimento);

  const tabs: { id: TabId; label: string; icon: typeof User }[] = [
    { id: "resumo", label: "Resumo", icon: Printer },
    { id: "avaliacao", label: "Avaliação", icon: Stethoscope },
    { id: "orcamentos", label: termo.orcamento, icon: ShoppingBag },
    { id: "evolucao", label: "Evolução", icon: Activity },
    { id: "receituario", label: "Receituário", icon: Pill },
    { id: "galeria", label: "Galeria", icon: Camera },
    { id: "documentos", label: "Documentos", icon: FileText },
    { id: "dados", label: "Dados", icon: User },
  ];

  // S3: Planos (orçamento). S2-3: Evolução/Receituário/Galeria.
  const emConstrucao: Record<string, string> = {
    orcamentos: "Planos de tratamento chegam no Sprint 3 (funil comercial).",
    evolucao: "Evolução clínica chega ainda no Sprint 2 (próxima slice).",
    receituario: "Receituário chega com a evolução (próxima slice).",
    galeria: "Galeria antes/depois chega com a evolução (próxima slice).",
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/painel/prontuarios"
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{paciente.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {[paciente.telefone, idade ? `${idade} anos` : null, convenioNome || "Particular"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab !== "resumo" && (
        <button
          onClick={() => setTab("resumo")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Resumo
        </button>
      )}

      {tab === "resumo" && (
        <AbaResumo
          avaliacoes={avaliacoes}
          documentos={documentos}
          onNavigate={(t) => setTab(t as TabId)}
        />
      )}
      {tab === "avaliacao" && (
        <AbaAvaliacao
          clinicaId={clinicaId}
          pacienteId={paciente.id}
          avaliacoes={avaliacoes}
          profissionais={profissionais}
          podeEditar={podeEditar}
        />
      )}
      {tab === "documentos" && (
        <AbaDocumentos
          clinicaId={clinicaId}
          pacienteId={paciente.id}
          documentos={documentos}
          podeEditar={podeEditar}
        />
      )}
      {tab === "dados" && (
        <DadosPaciente paciente={paciente} convenioNome={convenioNome} idade={idade} />
      )}
      {emConstrucao[tab] && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Construction className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground max-w-md">{emConstrucao[tab]}</p>
          {tipoClinica === "odontologica" && tab === "orcamentos" && (
            <p className="text-xs text-muted-foreground mt-1">(Odontograma no plano de tratamento.)</p>
          )}
        </div>
      )}
    </div>
  );
}

function DadosPaciente({
  paciente,
  convenioNome,
  idade,
}: {
  paciente: PacienteProntuario;
  convenioNome: string | null;
  idade: number | null;
}) {
  const fmtData = (iso: string | null) => {
    if (!iso) return null;
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  };
  const campos = [
    { label: "CPF", value: paciente.cpf },
    {
      label: "Data de Nascimento",
      value: paciente.data_nascimento ? `${fmtData(paciente.data_nascimento)} (${idade} anos)` : null,
    },
    { label: "Sexo", value: paciente.sexo ? paciente.sexo[0].toUpperCase() + paciente.sexo.slice(1) : null },
    { label: "Telefone", value: paciente.telefone },
    { label: "Email", value: paciente.email },
    { label: "Convênio", value: convenioNome || "Particular" },
    { label: "Nº Carteirinha", value: paciente.numero_carteirinha },
    { label: "Nome da Mãe", value: paciente.nome_mae },
    { label: "Endereço", value: paciente.logradouro, full: true },
  ].filter((c) => c.value);

  const emergencia = [
    paciente.contato_emergencia_nome,
    paciente.contato_emergencia_parentesco ? `(${paciente.contato_emergencia_parentesco})` : null,
    paciente.contato_emergencia_telefone,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {campos.map(({ label, value, full }) => (
          <div key={label} className={`space-y-0.5 ${full ? "col-span-2 md:col-span-3" : ""}`}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-sm">{value}</p>
          </div>
        ))}
      </div>
      {emergencia && (
        <div className="border border-border rounded-xl p-4 bg-yellow-50 dark:bg-yellow-900/10">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            Contato de Emergência
          </p>
          <p className="text-sm font-medium">{emergencia}</p>
        </div>
      )}
      {paciente.observacoes && (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Observações</p>
          <p className="text-sm whitespace-pre-wrap">{paciente.observacoes}</p>
        </div>
      )}
    </div>
  );
}
