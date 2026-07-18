import { describe, expect, it } from "vitest";

import { agruparCidades, chaveCidade, filtrarClinicas } from "@/lib/busca";

type C = { id: string; tipo: string | null; cidade: string | null };
const cli = (id: string, tipo: string | null, cidade: string | null): C => ({ id, tipo, cidade });

describe("chaveCidade — normalização acento/caixa/espaço", () => {
  it("remove acento e caixa", () => {
    expect(chaveCidade("São Paulo")).toBe("sao paulo");
    expect(chaveCidade("SÃO PAULO")).toBe("sao paulo");
    expect(chaveCidade("sao paulo")).toBe("sao paulo");
  });

  it("colapsa espaços e apara bordas", () => {
    expect(chaveCidade("  Rio   de  Janeiro ")).toBe("rio de janeiro");
  });
});

describe("agruparCidades — consolida grafias divergentes", () => {
  it("junta 'São Paulo' e 'SÃO PAULO' numa cidade só, preferindo caixa mista", () => {
    expect(agruparCidades(["SÃO PAULO", "São Paulo", "são paulo"])).toEqual(["São Paulo"]);
  });

  it("ordena e mantém cidades distintas", () => {
    expect(agruparCidades(["Santos", "Campinas", "SANTOS"])).toEqual(["Campinas", "Santos"]);
  });
});

describe("filtrarClinicas — composição (o legado tinha 3 motores concorrentes)", () => {
  const clinicas = [
    cli("a", "medica", "São Paulo"),
    cli("b", "estetica", "SÃO PAULO"), // mesma cidade, grafia diferente
    cli("c", "medica", "Campinas"),
  ];
  const esp = new Map<string, string[]>([
    ["a", ["cardio"]],
    ["b", ["derma"]],
    ["c", ["cardio"]],
  ]);

  it("cidade acento/caixa-insensível: 'São Paulo' pega a clínica em 'SÃO PAULO'", () => {
    const r = filtrarClinicas(clinicas, { tipo: null, cidades: ["São Paulo"], especialidades: [] }, esp);
    expect(r.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("os 3 filtros COMPÕEM simultaneamente (AND entre grupos)", () => {
    const r = filtrarClinicas(
      clinicas,
      { tipo: "medica", cidades: ["São Paulo"], especialidades: ["cardio"] },
      esp
    );
    // medica ∧ São Paulo ∧ cardio → só 'a' (b é estetica/derma, c é Campinas)
    expect(r.map((c) => c.id)).toEqual(["a"]);
  });

  it("OR dentro de cada grupo (2 cidades, 2 especialidades)", () => {
    const r = filtrarClinicas(
      clinicas,
      { tipo: null, cidades: ["São Paulo", "Campinas"], especialidades: ["cardio", "derma"] },
      esp
    );
    expect(r.map((c) => c.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("sem critérios devolve todas", () => {
    const r = filtrarClinicas(clinicas, { tipo: null, cidades: [], especialidades: [] }, esp);
    expect(r.length).toBe(3);
  });

  it("especialidade que ninguém tem → vazio", () => {
    const r = filtrarClinicas(clinicas, { tipo: null, cidades: [], especialidades: ["neuro"] }, esp);
    expect(r).toEqual([]);
  });
});
