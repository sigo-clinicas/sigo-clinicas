// Gera src/components/publico/icones.tsx a partir dos SVGs ORIGINAIS do
// @ant-design/icons instalado no repo antigo — os mesmos que o Sticky/Footer
// renderizavam via <Icon type=... theme="filled" /> e <MenuOutlined />.
// Extrair programaticamente evita erro de transcricao nos paths.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire(
  "c:/Users/neemi/sigo-clinicas/repositorio-antigo/sigo-clinicas-www/node_modules/@ant-design/icons-svg/lib/asn/"
);

// Nome antd -> nome do componente React
const ICONES = [
  ["FacebookFilled", "IconeFacebook"],
  ["LinkedinFilled", "IconeLinkedin"],
  ["YoutubeFilled", "IconeYoutube"],
  ["InstagramFilled", "IconeInstagram"],
  ["MenuOutlined", "IconeMenu"],
  // seta dos Select do hero (o antd 3 renderiza este icone no .ant-select-arrow)
  ["DownOutlined", "IconeSeta"],
];

function coletarPaths(no, saida = []) {
  if (!no) return saida;
  if (no.tag === "path" && no.attrs && no.attrs.d) saida.push(no.attrs.d);
  for (const filho of no.children || []) coletarPaths(filho, saida);
  return saida;
}

// Icones do Font Awesome que o site antigo usava nos botoes de app
// (<i class="fab fa-apple"> / <i class="fab fa-android">). O components/Meta.js
// carregava a v5.5.0 por CDN; buscamos os SVGs originais dessa MESMA versao.
const ICONES_FA = [
  ["apple", "IconeApple"],
  ["android", "IconeAndroid"],
];

const partes = [
  `// Icones ORIGINAIS do sistema antigo. Gerado por scripts/gerar-icones.mjs.`,
  `//`,
  `// - antd: extraidos do @ant-design/icons que o repo antigo tem instalado (os`,
  `//   mesmos paths que o <Icon theme="filled" /> do antd 3 e o <MenuOutlined />`,
  `//   renderizavam).`,
  `// - Font Awesome: baixados da CDN v5.5.0, a mesma versao que o Meta.js antigo`,
  `//   linkava, para os <i class="fab fa-apple|fa-android"> dos botoes de app.`,
  `//`,
  `// Reimplementados como SVG inline para nao arrastar o antd (React 16, EOL) nem`,
  `// depender de CDN externa em runtime. Todos renderizam 1em + fill currentColor,`,
  `// entao font-size e color continuam controlando o icone como no CSS antigo.`,
  ``,
];

for (const [nomeAntd, nomeReact] of ICONES) {
  const mod = require(
    `c:/Users/neemi/sigo-clinicas/repositorio-antigo/sigo-clinicas-www/node_modules/@ant-design/icons-svg/lib/asn/${nomeAntd}.js`
  );
  const def = mod.default || mod;
  const icone = typeof def.icon === "function" ? def.icon("#333", "#E6E6E6") : def.icon;
  const viewBox = (icone.attrs && icone.attrs.viewBox) || "64 64 896 896";
  const paths = coletarPaths(icone);
  if (!paths.length) throw new Error(`sem path: ${nomeAntd}`);

  partes.push(
    `/** ${nomeAntd} (antd) */`,
    `export function ${nomeReact}(props: React.SVGProps<SVGSVGElement>) {`,
    `  return (`,
    `    <svg`,
    `      viewBox="${viewBox}"`,
    `      width="1em"`,
    `      height="1em"`,
    `      fill="currentColor"`,
    `      aria-hidden="true"`,
    `      focusable="false"`,
    `      {...props}`,
    `    >`,
    ...paths.map((d) => `      <path d="${d}" />`),
    `    </svg>`,
    `  );`,
    `}`,
    ``
  );
}

for (const [nomeFa, nomeReact] of ICONES_FA) {
  const svg = await (
    await fetch(`https://use.fontawesome.com/releases/v5.5.0/svgs/brands/${nomeFa}.svg`)
  ).text();
  const viewBox = svg.match(/viewBox="([^"]+)"/);
  const d = svg.match(/\sd="([^"]+)"/);
  if (!viewBox || !d) throw new Error(`SVG inesperado: ${nomeFa}`);

  // De proposito SEM atributo `width`: o glifo do Font Awesome nao e um quadrado
  // de 1em — ele tem a largura do proprio icone (apple = 376.5/512 = 0.735em;
  // medimos 19.1x26 no site antigo). Declarando so a altura, o SVG assume a
  // proporcao do viewBox e reproduz a largura do glifo. Com width="1em" sairia
  // 26x26, e o atributo ainda venceria um `width: auto` vindo do CSS.
  partes.push(
    `/** fa-${nomeFa} (Font Awesome 5.5.0, brands) */`,
    `export function ${nomeReact}(props: React.SVGProps<SVGSVGElement>) {`,
    `  return (`,
    `    <svg`,
    `      viewBox="${viewBox[1]}"`,
    `      height="1em"`,
    `      fill="currentColor"`,
    `      aria-hidden="true"`,
    `      focusable="false"`,
    `      {...props}`,
    `    >`,
    `      <path d="${d[1]}" />`,
    `    </svg>`,
    `  );`,
    `}`,
    ``
  );
}

const destino =
  "c:/Users/neemi/sigo-clinicas/sigo-clinicas/src/components/publico/icones.tsx";
writeFileSync(destino, partes.join("\n"));
const total = ICONES.length + ICONES_FA.length;
console.log(`${total} icones gerados em ${destino}`);
for (const [a, r] of ICONES) console.log(`  antd  ${a.padEnd(16)} -> ${r}`);
for (const [a, r] of ICONES_FA) console.log(`  fa    ${a.padEnd(16)} -> ${r}`);
