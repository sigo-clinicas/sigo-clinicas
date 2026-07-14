import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientServiceRole, temAmbiente } from "./helpers";
import { resolverClinicaLead } from "@/lib/leads";

/**
 * S3-9 — Regressão do achado de segurança: no lead com origem=marketplace o
 * clinica_id NÃO pode vir do corpo do request sem validação. resolverClinicaLead
 * (usado pelo Route Handler /api/publico/lead) só aceita clínica pública; cupom
 * deriva do próprio cupom. Um clinica_id privado/arbitrário vira null.
 */
describe.skipIf(!temAmbiente)("Lead: validação de tenant no servidor (S3-9)", () => {
  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let admin: SupabaseClient;
  let clinicaPub: string, clinicaPriv: string, cupomPriv: string;

  beforeAll(async () => {
    admin = clientServiceRole();
    const { data: clinicas } = await admin
      .from("clinica")
      .insert([
        { nome: `LeadPub ${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: true },
        { nome: `LeadPriv ${sufixo}`, tipo: "medica", ativo: true, exibir_marketplace: false },
      ])
      .select("id");
    [clinicaPub, clinicaPriv] = clinicas!.map((c) => c.id);

    const { data: cup } = await admin
      .from("cupom")
      .insert({
        clinica_id: clinicaPriv,
        codigo: `CUP-${sufixo}`,
        tipo_desconto: "percentual",
        valor_desconto: 10,
        status: "ativo",
        quantidade_usos: 1,
      })
      .select("id")
      .single();
    cupomPriv = cup!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (clinicaPub) await admin.from("clinica").delete().in("id", [clinicaPub, clinicaPriv]);
  });

  it("marketplace: aceita clínica PÚBLICA", async () => {
    const r = await resolverClinicaLead(admin, { origem: "marketplace", clinica_id: clinicaPub });
    expect(r).toBe(clinicaPub);
  });

  it("marketplace: REJEITA clínica não-pública (→ null)", async () => {
    const r = await resolverClinicaLead(admin, { origem: "marketplace", clinica_id: clinicaPriv });
    expect(r).toBeNull();
  });

  it("marketplace: REJEITA clinica_id inexistente/arbitrário (→ null)", async () => {
    const r = await resolverClinicaLead(admin, {
      origem: "marketplace",
      clinica_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(r).toBeNull();
  });

  it("marketplace sem clinica_id → null (lead global)", async () => {
    const r = await resolverClinicaLead(admin, { origem: "marketplace" });
    expect(r).toBeNull();
  });

  it("cupom: deriva o clinica_id do próprio cupom (não do cliente)", async () => {
    const r = await resolverClinicaLead(admin, { origem: "cupom", cupom_id: cupomPriv });
    expect(r).toBe(clinicaPriv); // do cupom, mesmo sendo clínica privada
  });
});
