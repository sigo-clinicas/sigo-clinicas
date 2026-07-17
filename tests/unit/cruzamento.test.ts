import { describe, expect, it } from "vitest";

import {
  profissionaisParaServicos,
  servicosParaProfissional,
  type Vinculo,
} from "@/lib/cruzamento";

// S1 — lógica pura do cruzamento serviço↔profissional. A armadilha central é a
// clínica SEM adjacência mapeada: filtrar por ausência de dado esconderia tudo.

const P = (id: string) => ({ id });
const S = (id: string) => ({ id });

describe("cruzamento serviço↔profissional", () => {
  // clínica: profA faz s1,s2 ; profB faz s2 ; profC não tem vínculo mapeado
  const vinculos: Vinculo[] = [
    { profissional_id: "A", servico_id: "s1" },
    { profissional_id: "A", servico_id: "s2" },
    { profissional_id: "B", servico_id: "s2" },
  ];
  const profs = [P("A"), P("B"), P("C")];
  const servs = [S("s1"), S("s2"), S("s3")];

  describe("serviço → profissional", () => {
    it("sem serviço marcado, devolve todos os profissionais", () => {
      expect(profissionaisParaServicos(profs, vinculos, []).map((p) => p.id)).toEqual(["A", "B", "C"]);
    });

    it("um serviço marcado lista quem o faz", () => {
      expect(profissionaisParaServicos(profs, vinculos, ["s1"]).map((p) => p.id)).toEqual(["A"]);
      expect(profissionaisParaServicos(profs, vinculos, ["s2"]).map((p) => p.id)).toEqual(["A", "B"]);
    });

    it("dois serviços marcados exigem quem faz AMBOS (AND)", () => {
      expect(profissionaisParaServicos(profs, vinculos, ["s1", "s2"]).map((p) => p.id)).toEqual(["A"]);
    });

    it("serviço SEM adjacência mapeada não restringe (não esconde por ausência de dado)", () => {
      // s3 não tem nenhum vínculo → tratar como 'desconhecido', não como 'ninguém'
      expect(profissionaisParaServicos(profs, vinculos, ["s3"]).map((p) => p.id)).toEqual(["A", "B", "C"]);
    });

    it("clínica sem nenhuma adjacência devolve todos", () => {
      expect(profissionaisParaServicos(profs, [], ["s1"]).map((p) => p.id)).toEqual(["A", "B", "C"]);
    });
  });

  describe("profissional → serviço", () => {
    it("sem profissional selecionado, devolve todos os serviços", () => {
      expect(servicosParaProfissional(servs, vinculos, null).map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    });

    it("profissional selecionado lista só os serviços dele", () => {
      expect(servicosParaProfissional(servs, vinculos, "A").map((s) => s.id)).toEqual(["s1", "s2"]);
      expect(servicosParaProfissional(servs, vinculos, "B").map((s) => s.id)).toEqual(["s2"]);
    });

    it("profissional SEM adjacência mapeada devolve todos (regressão: não esconde)", () => {
      // profC não tem vínculo → mostrar todos os serviços, não zero
      expect(servicosParaProfissional(servs, vinculos, "C").map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    });

    it("clínica sem nenhuma adjacência devolve todos", () => {
      expect(servicosParaProfissional(servs, [], "A").map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    });
  });
});
