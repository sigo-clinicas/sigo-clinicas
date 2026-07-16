import styles from "./anticon.module.css";

/**
 * Reproduz o <span class="anticon"> que o antd 3 punha em volta de todo icone.
 * Os SVGs de icones.tsx sao os originais do @ant-design/icons; este wrapper da
 * a eles a mesma caixa que tinham no site antigo, sem carregar o antd.
 */
export function Anticon({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="img"
      className={[styles.anticon, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
