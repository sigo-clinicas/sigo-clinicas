// Prova que react-slick/slick-carousel NAO entram no bundle do painel/ERP.
// Estrategia: achar os chunks que contem codigo do slick e cruzar com o
// app-build-manifest, que lista quais chunks cada rota carrega.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RAIZ = "c:/Users/neemi/sigo-clinicas/sigo-clinicas";
const DIR = join(RAIZ, ".next/static/chunks");

// 1. quais chunks contem o slick?
const marcas = ["slick-track", "slickGoTo", "slick-slider", "slickNext"];
const comSlick = new Set();
const varrer = (dir, prefixo = "") => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) varrer(join(dir, e.name), prefixo + e.name + "/");
    else if (e.name.endsWith(".js")) {
      const txt = readFileSync(join(dir, e.name), "utf8");
      if (marcas.some((m) => txt.includes(m))) comSlick.add(prefixo + e.name);
    }
  }
};
varrer(DIR);

// 2. quais rotas carregam cada chunk?
const manifesto = JSON.parse(readFileSync(join(RAIZ, ".next/app-build-manifest.json"), "utf8"));
const rotasDoChunk = new Map();
for (const [rota, arquivos] of Object.entries(manifesto.pages)) {
  for (const a of arquivos) {
    const nome = a.replace(/^static\/chunks\//, "");
    if (!rotasDoChunk.has(nome)) rotasDoChunk.set(nome, []);
    rotasDoChunk.get(nome).push(rota);
  }
}

console.log("=== CHUNKS COM CODIGO DO SLICK ===");
let violacao = false;
for (const chunk of comSlick) {
  const rotas = rotasDoChunk.get(chunk) ?? [];
  console.log(`\n${chunk}`);
  console.log(`  carregado por ${rotas.length} rota(s):`);
  for (const r of rotas) console.log(`    ${r}`);
  const proibidas = rotas.filter((r) => /^\/(painel|admin)/.test(r));
  if (proibidas.length) {
    violacao = true;
    console.log(`  >>> VIOLACAO: rotas pos-login carregam este chunk: ${proibidas.join(", ")}`);
  }
}

// 3. o painel carrega algum chunk com slick?
console.log("\n=== CHUNKS QUE O /painel CARREGA ===");
const doPainel = manifesto.pages["/painel/page"] ?? [];
const suspeitos = doPainel
  .map((a) => a.replace(/^static\/chunks\//, ""))
  .filter((c) => comSlick.has(c));
console.log(`  ${doPainel.length} arquivos; ${suspeitos.length} com slick`);

// 4. jquery em qualquer lugar?
let comJquery = [];
const varrerJq = (dir, prefixo = "") => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) varrerJq(join(dir, e.name), prefixo + e.name + "/");
    else if (e.name.endsWith(".js")) {
      const txt = readFileSync(join(dir, e.name), "utf8");
      if (/jQuery\.fn|jquery\.com|\$\.fn\.jquery/.test(txt)) comJquery.push(prefixo + e.name);
    }
  }
};
varrerJq(DIR);

console.log("\n=== JQUERY ===");
console.log(comJquery.length ? `  >>> VIOLACAO: ${comJquery.join(", ")}` : "  ausente de todos os chunks (so peerDependency do slick-carousel; nunca importamos o JS dele)");

console.log("\n==================================================");
console.log(
  violacao || suspeitos.length || comJquery.length
    ? ">>> FALHOU"
    : ">>> OK: slick so nas rotas publicas; jquery fora do bundle"
);
process.exit(violacao || suspeitos.length || comJquery.length ? 1 : 0);
