// Baixa os woff2 ORIGINAIS (subset latin) das 3 familias que o site antigo usava,
// a partir da API v1 do Google Fonts — a mesma que o components/Meta.js consumia.
// Gera public/static/fonts/*.woff2 + o CSS @font-face com os nomes literais.
//
// Ubuntu e Source Sans Pro sao estaticas (1 arquivo por peso).
// Open Sans hoje e VARIAVEL: o Google devolve o mesmo woff2 para todos os pesos,
// cada @font-face fixando um font-weight + font-stretch. Deduplicamos o arquivo.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Exatamente os pesos do Meta.js antigo (Lato foi descartada: carregada e nunca usada)
const FAMILIAS = [
  { css: "Ubuntu", arquivo: "ubuntu", pesos: [400, 500, 700] },
  { css: "Source Sans Pro", arquivo: "sourcesanspro", pesos: [400, 600, 700] },
  { css: "Open Sans", arquivo: "opensans", pesos: [400, 600, 700, 800] },
];

const DEST = "c:/Users/neemi/sigo-clinicas/sigo-clinicas/public/static/fonts";
mkdirSync(DEST, { recursive: true });

const regras = [];
const baixados = new Map(); // url -> nome do arquivo (dedupe de fonte variavel)
let bytesTotais = 0;

for (const fam of FAMILIAS) {
  const url = `https://fonts.googleapis.com/css?family=${encodeURIComponent(
    fam.css
  ).replace(/%20/g, "+")}:${fam.pesos.join(",")}`;
  const css = await (await fetch(url, { headers: { "User-Agent": UA } })).text();

  // Divide em blocos "/* subset */ @font-face {...}" e fica so com o latin.
  const blocos = css.split("/*").filter((b) => b.trim().startsWith("latin */"));

  // Uma familia e variavel quando todos os pesos apontam para a mesma URL.
  const urlDoPeso = new Map();
  for (const peso of fam.pesos) {
    const bloco = blocos.find((b) => new RegExp(`font-weight:\\s*${peso};`).test(b));
    if (!bloco) throw new Error(`FALTOU bloco latin: ${fam.css} ${peso}`);
    const src = bloco.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    if (!src) throw new Error(`SEM url woff2: ${fam.css} ${peso}`);
    urlDoPeso.set(peso, { url: src[1], bloco });
  }
  const urlsUnicas = new Set([...urlDoPeso.values()].map((v) => v.url));
  const variavel = urlsUnicas.size === 1 && fam.pesos.length > 1;
  if (variavel) console.log(`(${fam.css}: fonte variavel — 1 arquivo para ${fam.pesos.length} pesos)`);

  for (const peso of fam.pesos) {
    const { url: fonteUrl, bloco } = urlDoPeso.get(peso);
    const nome = variavel ? `${fam.arquivo}.woff2` : `${fam.arquivo}-${peso}.woff2`;

    if (!baixados.has(fonteUrl)) {
      const bin = Buffer.from(
        await (await fetch(fonteUrl, { headers: { "User-Agent": UA } })).arrayBuffer()
      );
      writeFileSync(join(DEST, nome), bin);
      baixados.set(fonteUrl, nome);
      bytesTotais += bin.length;
      console.log(`ok  ${nome.padEnd(24)} ${String(bin.length).padStart(7)} bytes`);
    }

    // Preserva unicode-range e font-stretch exatamente como o Google os emite.
    const range = bloco.match(/unicode-range:\s*([^;]+);/);
    const stretch = bloco.match(/font-stretch:\s*([^;]+);/);

    regras.push(
      `@font-face {\n` +
        `  font-family: '${fam.css}';\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${peso};\n` +
        (stretch ? `  font-stretch: ${stretch[1].trim()};\n` : "") +
        `  font-display: swap;\n` +
        `  src: url(/static/fonts/${baixados.get(fonteUrl)}) format('woff2');\n` +
        (range ? `  unicode-range: ${range[1].trim()};\n` : "") +
        `}`
    );
  }
}

const cabecalho = `/* Fontes ORIGINAIS do sistema antigo (repositorio-antigo/sigo-clinicas-www,
   components/Meta.js), auto-hospedadas: os woff2 vieram da mesma API v1 do Google
   que o site antigo consumia, subset latin. Gerado por scripts/baixar-fontes.mjs.

   Os nomes das familias sao LITERAIS de proposito. 'Source Sans Pro' nao existe no
   next/font — o Google a renomeou para Source Sans 3, que e um redesenho. Mantendo
   o nome literal, o CSS copiado dos styles.js antigos continua verbatim.

   Lato era carregada pelo Meta.js antigo e nunca usada — descartada.
   Open Sans hoje e variavel: 1 arquivo serve os 4 pesos.

   Importado APENAS por src/components/publico/* — nao alcanca o painel.
   @font-face so DECLARA fontes; nao estiliza nada por si so. */

`;

writeFileSync(
  "c:/Users/neemi/sigo-clinicas/sigo-clinicas/src/components/publico/fontes.css",
  cabecalho + regras.join("\n\n") + "\n"
);
console.log(
  `\n${regras.length} regras @font-face / ${baixados.size} arquivos / ${(bytesTotais / 1024).toFixed(0)} KB`
);
