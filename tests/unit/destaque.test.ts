import { describe, expect, it } from "vitest";

import { destaqueVigente, rotuloNivel } from "@/lib/destaque";

describe("rotuloNivel — selo de destaque", () => {
  it("parceiro/premium têm rótulo; neutro/nulo não", () => {
    expect(rotuloNivel("parceiro")).toBe("Parceiro");
    expect(rotuloNivel("premium")).toBe("Premium");
    expect(rotuloNivel("neutro")).toBeNull();
    expect(rotuloNivel(null)).toBeNull();
    expect(rotuloNivel("lixo")).toBeNull();
  });
});

describe("destaqueVigente", () => {
  const hoje = "2026-07-17";
  it("sem limites de vigência → vigente", () => {
    expect(destaqueVigente(hoje, null, null)).toBe(true);
  });
  it("antes do início → não vigente", () => {
    expect(destaqueVigente(hoje, "2026-08-01", null)).toBe(false);
  });
  it("depois do fim → não vigente", () => {
    expect(destaqueVigente(hoje, null, "2026-07-10")).toBe(false);
  });
  it("dentro da janela → vigente", () => {
    expect(destaqueVigente(hoje, "2026-07-01", "2026-07-31")).toBe(true);
  });
});
