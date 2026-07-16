"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./home.module.css";

/**
 * Porte do banner de cookies do HomeComponent antigo (ContainerCookie /
 * SpanCookie). Texto verbatim.
 *
 * Client-side puro: le/grava o cookie de consentimento no proprio navegador,
 * sem backend — igual ao original, que usava js-cookie. Aqui usamos
 * document.cookie direto para nao adicionar dependencia.
 *
 * O original abria a politica num Modal do antd (CookieContent). Como a fase 7
 * porta /cookies como pagina propria, o link leva para la — mesmo conteudo, sem
 * arrastar o antd so por causa do modal.
 */
export function CookieBanner() {
  // Comeca aceito para nao piscar o banner antes de sabermos o cookie (o
  // original fazia o mesmo: `cookieAccepted: true` no state inicial).
  const [aceito, setAceito] = useState(true);

  useEffect(() => {
    const temCookie = document.cookie
      .split("; ")
      .some((c) => c === "allow.cookies=true");
    setAceito(temCookie);
  }, []);

  if (aceito) return null;

  const aceitar = () => {
    // 1 ano, igual ao padrao do js-cookie quando o original chamava
    // Cookie.set('allow.cookies', true) sem expiracao explicita no closeModal.
    document.cookie = `allow.cookies=true; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setAceito(true);
  };

  return (
    <div className={styles.banner}>
      <span>
        Este site utiliza cookies para proporcionar a melhor experiência de
        navegação para você. Para saber mais, basta acessar nossa{" "}
        <Link href="/cookies" className={styles.linkCookie}>
          política de cookies
        </Link>
        .
      </span>
      <button onClick={aceitar}>Aceito</button>
    </div>
  );
}
