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
];

function coletarPaths(no, saida = []) {
  if (!no) return saida;
  if (no.tag === "path" && no.attrs && no.attrs.d) saida.push(no.attrs.d);
  for (const filho of no.children || []) coletarPaths(filho, saida);
  return saida;
}

const partes = [
  `// Icones ORIGINAIS do sistema antigo, extraidos do @ant-design/icons que o`,
  `// repo antigo tem instalado (os mesmos paths que o <Icon theme="filled" /> do`,
  `// antd 3 e o <MenuOutlined /> renderizavam). Gerado por scripts/gerar-icones.mjs.`,
  `//`,
  `// Reimplementados como SVG inline para nao arrastar o antd (React 16, EOL) nem`,
  `// depender de CDN externa. O antd renderiza width/height 1em + fill currentColor,`,
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

const destino =
  "c:/Users/neemi/sigo-clinicas/sigo-clinicas/src/components/publico/icones.tsx";
writeFileSync(destino, partes.join("\n"));
console.log(`${ICONES.length} icones gerados em ${destino}`);
for (const [a, r] of ICONES) console.log(`  ${a.padEnd(18)} -> ${r}`);
