import { Footer } from "./footer";
import { Sticky } from "./sticky";

// Fontes ORIGINAIS do site antigo, auto-hospedadas. Importadas aqui (e nao no
// src/app/layout.tsx, que e do painel tambem) para que so as telas publicas as
// carreguem. @font-face apenas declara fontes — nao estiliza nada sozinho.
import "./fontes.css";
import styles from "./public-shell.module.css";

/**
 * Moldura das telas publicas: header fixo + conteudo + rodape, com a tipografia
 * e o reset do site antigo escopados em .shell.
 *
 * No antigo nao havia layout: cada pagina renderizava <Sticky/> ... <Footer/>
 * dentro de um Fragment (ver HomeComponent, LoginComponent, BuscaComponent).
 * Mantemos o mesmo modelo — cada pagina publica se envolve neste shell — em vez
 * de criar um layout de rota, porque `/` e `/buscar` moram na raiz de src/app e
 * dividem o layout.tsx com o painel, que nao pode ser tocado.
 *
 * `inside`: mesma prop do Sticky antigo. Nas telas sem hero atras do header
 * (login, detalhes), o header e opaco e os links ficam escuros.
 */
export function PublicShell({
  children,
  inside = false,
}: {
  children: React.ReactNode;
  inside?: boolean;
}) {
  return (
    <div className={styles.shell}>
      <Sticky inside={inside} />
      {children}
      <Footer />
    </div>
  );
}
