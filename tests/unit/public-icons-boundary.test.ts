import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regressão do bug de /buscar (useContext null no SSR): no lucide-react 1.24.0
 * cada ícone consome um React Context ("use client"); importado direto por um
 * React Server Component, o useContext roda no render do servidor sem
 * dispatcher e quebra a página. Rotas públicas são SSR — seus Server Components
 * NÃO podem importar de "lucide-react" direto; têm de usar o barrel client
 * @/components/lucide-icons (que restaura a fronteira). Um render em jsdom não
 * reproduz o caso (dispatcher válido), então este guard estático varre as pastas
 * públicas e falha se qualquer Server Component voltar a importar lucide direto.
 */
const dir = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(dir, "../..");

// pastas de rotas/componentes servidos publicamente (SSR)
const PASTAS_PUBLICAS = [
  "src/app/buscar",
  "src/app/clinica",
  "src/app/(publico)",
  "src/components/marketplace",
];

function tsxRecursivo(abs: string): string[] {
  const out: string[] = [];
  let entradas: import("node:fs").Dirent[] = [];
  try {
    entradas = readdirSync(abs, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entradas) {
    const p = path.join(abs, e.name);
    if (e.isDirectory()) out.push(...tsxRecursivo(p));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const arquivos = PASTAS_PUBLICAS.flatMap((rel) => tsxRecursivo(path.join(raiz, rel)));

describe("Ícones em rotas públicas ficam atrás da fronteira de client (bug /buscar)", () => {
  it("há arquivos públicos para verificar", () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  for (const abs of arquivos) {
    const rel = path.relative(raiz, abs).replaceAll("\\", "/");
    it(`${rel}: Server Component não importa lucide-react direto`, () => {
      const src = readFileSync(abs, "utf8");
      const ehClient = /^﻿?\s*["']use client["']/.test(src);
      const importaLucideDireto = /from\s+["']lucide-react["']/.test(src);
      // Client Components podem importar direto (têm dispatcher no SSR).
      // Server Components não: têm de passar pelo barrel client.
      if (!ehClient && importaLucideDireto) {
        throw new Error(
          `${rel} é Server Component e importa ícones de "lucide-react" direto — ` +
            `use "@/components/lucide-icons" (fronteira de client) para não quebrar o SSR.`
        );
      }
      expect(true).toBe(true);
    });
  }
});
