// Extrai o JSX interno de cada *Content antigo e gera componentes funcionais
// .tsx, para portar o texto legal VERBATIM (sem risco de typo ao reescrever).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const ANT = "c:/Users/neemi/sigo-clinicas/repositorio-antigo/sigo-clinicas-www/components";
const DEST = "c:/Users/neemi/sigo-clinicas/sigo-clinicas/src/components/publico/legais";
mkdirSync(DEST, { recursive: true });

// pagina -> [arquivos de conteudo, na ordem em que o *Component antigo renderiza]
const PAGINAS = {
  Termos: ["TermsComponent/TermsContent/index.js"],
  Privacidade: ["PrivacyComponent/PrivacyContent/index.js"],
  Cookies: ["CookieComponent/CookieContent/index.js"],
  // a pagina /lgpd (ConsentComponent) renderiza ConsentContent seguido de LgpdContent
  Lgpd: ["ConsentComponent/ConsentContent/index.js", "ConsentComponent/LgpdContent/index.js"],
};

// pega o JSX entre o PRIMEIRO <Fragment> e o ULTIMO </Fragment>. Contar
// parenteses nao funciona: o texto legal tem parenteses proprios (listas "a)
// b) c)", "(...)") que desbalanceiam o contador.
function extrairJsx(src) {
  const abre = src.indexOf("<Fragment>");
  const fecha = src.lastIndexOf("</Fragment>");
  if (abre < 0 || fecha < 0) throw new Error("sem <Fragment>");
  let jsx = src.slice(abre + "<Fragment>".length, fecha).trim();
  // ConsentContent injeta {this.props.lgpdContent}: a pagina /lgpd ja renderiza
  // o LgpdContent em seguida, entao removemos a injecao (evita conteudo duplicado)
  jsx = jsx.replace(/\{this\.props\.lgpdContent\}/g, "");
  return jsx;
}

for (const [nome, arquivos] of Object.entries(PAGINAS)) {
  const blocos = arquivos.map((a) => extrairJsx(readFileSync(`${ANT}/${a}`, "utf8")));
  const corpo = blocos.join("\n\n");
  const componente = `/* eslint-disable react/no-unescaped-entities */
// Conteudo legal portado VERBATIM do sistema antigo
// (${arquivos.join(" + ")}). Gerado por scripts/extrair-legais.mjs — nao editar
// o texto a mao. O eslint-disable acima permite aspas tipograficas no texto
// (react/no-unescaped-entities e regra de estilo, nao de correcao).

export function Conteudo${nome}() {
  return (
    <>
${corpo
  .split("\n")
  .map((l) => "      " + l)
  .join("\n")}
    </>
  );
}
`;
  const destino = `${DEST}/${nome.toLowerCase()}.tsx`;
  writeFileSync(destino, componente);
  console.log(`ok  ${nome.padEnd(12)} <- ${arquivos.join(" + ")}  (${corpo.split("\n").length} linhas)`);
}
