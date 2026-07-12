import { createClient } from "@/lib/supabase/server";

import { EspecialidadesAdminClient } from "./especialidades-admin-client";

// CRUD global de segmento → especialidade (S1-4). Tela NOVA (não existia no
// protótipo Base44 — lá especialidade era string livre, achado A4); seed
// vem das 66 do legado (migration 0200), editável pelo admin (call 02/07).
export default async function EspecialidadesAdminPage() {
  const supabase = createClient();

  const [{ data: segmentos }, { data: especialidades }] = await Promise.all([
    supabase.from("segmento").select("id,nome,ativo").order("nome"),
    supabase
      .from("especialidade")
      .select("id,segmento_id,nome,ativo")
      .order("nome"),
  ]);

  return (
    <EspecialidadesAdminClient
      segmentos={segmentos ?? []}
      especialidades={especialidades ?? []}
    />
  );
}
