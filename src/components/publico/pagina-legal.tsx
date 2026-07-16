import { PublicShell } from "./public-shell";
import styles from "./legais.module.css";

/**
 * Moldura das paginas de conteudo legal (termos, privacidade, cookies, lgpd).
 * Porte do padrao comum dos *Component antigos: Sticky inside + Hero centralizado
 * dentro do .container + Footer. O conteudo vai verbatim (ver legais/*.tsx).
 */
export function PaginaLegal({ children }: { children: React.ReactNode }) {
  return (
    <PublicShell inside>
      <header className={styles.hero}>
        <div className="container">{children}</div>
      </header>
    </PublicShell>
  );
}
