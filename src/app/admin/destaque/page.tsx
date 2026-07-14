import { createClient } from "@/lib/supabase/server";

import { DestaqueClient } from "./destaque-client";

// S4-2 — Admin de plataforma: configura o destaque/ranqueamento das clínicas
// (nivel + score). O MODELO DE COBRANÇA (assinatura|período|leilão) é decisão
// pendente da cliente — aqui só a estrutura (S3-6). O layout /admin já garante
// isAdmin. Escrita via clinica_destaque_admin (RLS só admin).
export default async function DestaquePage() {
  const supabase = createClient();
  const [{ data: clinicas }, { data: destaques }] = await Promise.all([
    supabase
      .from("marketplace_clinica")
      .select("id,nome,cidade,ranking")
      .order("ranking", { ascending: false }),
    supabase
      .from("clinica_destaque")
      .select("clinica_id,nivel,score_manual,ativo,vigencia_inicio,vigencia_fim"),
  ]);

  const porClinica = new Map(
    (destaques ?? []).map((d) => [d.clinica_id, d])
  );
  const linhas = (clinicas ?? [])
    .filter((c) => c.id && c.nome)
    .map((c) => ({
      id: c.id as string,
      nome: c.nome as string,
      cidade: c.cidade,
      ranking: Number(c.ranking ?? 0),
      destaque: porClinica.get(c.id as string) ?? null,
    }));

  return <DestaqueClient linhas={linhas} />;
}
