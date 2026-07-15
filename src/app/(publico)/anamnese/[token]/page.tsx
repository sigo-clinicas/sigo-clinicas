import { AlertCircle, CheckCircle2 } from "@/components/lucide-icons";

import type { Pergunta } from "@/lib/actions/anamnese";
import { PreencherAnamnese } from "./preencher-client";

// Porta de reference/base44 src/pages/anamnese/PreencherAnamnese.jsx.
// Página PÚBLICA (sem login). O carregamento (get) chama a Edge Function
// anamnese-publica server-side — nunca supabase-js no browser. A Edge valida o
// token (uuid), expiração e status; aqui só ramificamos os estados.
export const dynamic = "force-dynamic";

type GetResposta = {
  status?: "pendente" | "preenchido";
  already_filled?: boolean;
  formulario?: { nome: string; descricao: string | null; perguntas: Pergunta[] } | null;
  paciente_nome?: string | null;
  error?: string;
};

async function carregar(token: string): Promise<{ http: number; body: GetResposta }> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/anamnese-publica`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "get", token }),
      cache: "no-store",
    });
    const body = (await r.json().catch(() => ({}))) as GetResposta;
    return { http: r.status, body };
  } catch {
    return { http: 0, body: { error: "network" } };
  }
}

function Aviso({ titulo, texto, ok }: { titulo: string; texto: string; ok?: boolean }) {
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      {ok ? (
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
      ) : (
        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
      )}
      <h1 className="text-lg font-semibold">{titulo}</h1>
      <p className="text-sm text-muted-foreground mt-1">{texto}</p>
    </div>
  );
}

export default async function AnamnesePublicaPage({
  params,
}: {
  params: { token: string };
}) {
  const { http, body } = await carregar(params.token);

  if (http === 410 || body.error === "expired") {
    return <Aviso titulo="Link expirado" texto="Este link de anamnese não é mais válido. Peça um novo à clínica." />;
  }
  if (http !== 200 || !body.formulario) {
    return <Aviso titulo="Formulário não encontrado" texto="Verifique o link recebido ou contate a clínica." />;
  }
  if (body.already_filled || body.status === "preenchido") {
    return (
      <Aviso
        ok
        titulo="Anamnese já respondida"
        texto="Este formulário já foi preenchido. Obrigado!"
      />
    );
  }

  return (
    <PreencherAnamnese
      token={params.token}
      nome={body.formulario.nome}
      descricao={body.formulario.descricao}
      pacienteNome={body.paciente_nome ?? null}
      perguntas={body.formulario.perguntas ?? []}
    />
  );
}
