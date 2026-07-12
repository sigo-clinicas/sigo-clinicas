import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Apaga TODOS os objetos de Storage de um paciente (anonimização LGPD). O
 * Supabase proíbe DELETE direto em storage.objects, então isto roda pela Storage
 * API com service_role — fora da RPC. Os paths seguem
 * `<clinica_id>/<pasta>/<paciente_id>/<arquivo>`, então listamos cada pasta do
 * paciente por clínica e removemos o que houver.
 */
const BUCKETS: Record<string, string[]> = {
  prontuario: ["avaliacoes", "evolucoes", "galeria"],
  documentos: ["documentos", "assinaturas"],
};

export async function limparStoragePaciente(
  admin: SupabaseClient,
  pacienteId: string,
  clinicaIds: string[]
): Promise<number> {
  let removidos = 0;
  for (const [bucket, pastas] of Object.entries(BUCKETS)) {
    for (const clinica of clinicaIds) {
      for (const pasta of pastas) {
        const prefixo = `${clinica}/${pasta}/${pacienteId}`;
        const { data } = await admin.storage.from(bucket).list(prefixo, { limit: 1000 });
        if (data && data.length > 0) {
          const paths = data.map((o) => `${prefixo}/${o.name}`);
          await admin.storage.from(bucket).remove(paths);
          removidos += paths.length;
        }
      }
    }
  }
  return removidos;
}
