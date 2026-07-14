import { describe, expect, it } from "vitest";

import { escapeHtml } from "@/lib/sanitize";

// Regressão do achado de segurança S3-8/S3-9: nome/telefone do agendamento
// público entram no HTML do e-mail; sem escape, permitiria injeção/phishing.
describe("escapeHtml (regressão HTML injection — S3-9)", () => {
  it("escapa os metacaracteres de HTML", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(escapeHtml(`a"b'c&d`)).toBe("a&quot;b&#39;c&amp;d");
  });

  it("neutraliza uma tag de âncora/phishing (não parseia como HTML)", () => {
    const malicioso = `<a href="http://mal.example">clique</a>`;
    const seguro = escapeHtml(malicioso);
    // sem `<`, `>` ou `"` literais, o navegador não interpreta como tag/atributo
    expect(seguro).not.toContain("<");
    expect(seguro).not.toContain(">");
    expect(seguro).not.toContain('"');
    expect(seguro).toContain("&lt;a");
  });

  it("texto comum passa inalterado (sem metacaracteres)", () => {
    expect(escapeHtml("Maria Silva 11 99999-0000")).toBe("Maria Silva 11 99999-0000");
  });
});
