import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Pergunta } from "@/lib/actions/anamnese";

import { AnamneseClient, type FormularioLinha } from "./anamnese-client";

// Porta de reference/base44 src/pages/anamnese/FormulariosAnamnese.jsx (config).
// RLS filtra por clinica_id; só papéis de escrita editam (checado na Server Action).
export default async function AnamnesePage() {
  const sessao = await getSessaoComClaims();
  if (!sessao?.clinicaAtual || !sessao.papel) redirect("/login");

  const supabase = createClient();
  const { data: formularios } = await supabase
    .from("formulario_anamnese")
    .select("id,nome,descricao,ativo,perguntas")
    .order("created_at", { ascending: false });

  const podeEditar =
    ["proprietario", "gerente", "recepcionista", "assistente"].includes(sessao.papel) ||
    sessao.isAdmin;

  const linhas: FormularioLinha[] = (formularios ?? []).map((f) => ({
    id: f.id,
    nome: f.nome,
    descricao: f.descricao,
    ativo: f.ativo,
    perguntas: (f.perguntas as unknown as Pergunta[]) ?? [],
  }));

  return <AnamneseClient formularios={linhas} podeEditar={podeEditar} />;
}
