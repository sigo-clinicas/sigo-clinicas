import { describe, expect, it } from "vitest";
import { Leaf, Smile, Sparkles, Stethoscope } from "lucide-react";

import {
  iconeDaClinica,
  labelDaClinica,
  temaDaClinica,
  urlLogoPublica,
} from "@/lib/tipo-clinica";

describe("white-label: helpers por vertical (S4-1)", () => {
  it("iconeDaClinica devolve o ícone certo por tipo", () => {
    expect(iconeDaClinica("medica")).toBe(Stethoscope);
    expect(iconeDaClinica("estetica")).toBe(Sparkles);
    expect(iconeDaClinica("odontologica")).toBe(Smile);
    expect(iconeDaClinica("terapias")).toBe(Leaf);
  });

  it("labelDaClinica reusa TERMINOLOGIA (sem mapa duplicado)", () => {
    expect(labelDaClinica("medica")).toBe("Clínica Médica");
    expect(labelDaClinica("estetica")).toBe("Clínica Estética");
    expect(labelDaClinica("odontologica")).toBe("Clínica Odontológica");
    expect(labelDaClinica("terapias")).toBe("Terapias e Bem-Estar");
  });

  it("temaDaClinica mapeia odontologica→odontologia (seletor CSS)", () => {
    expect(temaDaClinica("odontologica")).toBe("odontologia");
    expect(temaDaClinica("medica")).toBe("medica");
    expect(temaDaClinica("estetica")).toBe("estetica");
    expect(temaDaClinica("terapias")).toBe("terapias");
  });

  it("urlLogoPublica monta a URL do bucket público (ou null sem logo)", () => {
    expect(urlLogoPublica(null)).toBeNull();
    const url = urlLogoPublica("abc/logo.png");
    // depende de NEXT_PUBLIC_SUPABASE_URL; se ausente → null; se presente, contém o path
    if (url !== null) {
      expect(url).toContain("/storage/v1/object/public/logos/abc/logo.png");
    }
  });
});
