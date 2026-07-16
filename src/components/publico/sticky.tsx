"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Anticon } from "./anticon";
import { EmBreve } from "./em-breve";
import { IconeMenu } from "./icones";
import styles from "./sticky.module.css";

/**
 * Porte de repositorio-antigo/sigo-clinicas-www/components/Sticky.
 *
 * Renderiza SEMPRE o estado deslogado. O header antigo tinha tambem um estado
 * logado (avatar + dropdown "Editar perfil" / "Meus compromissos") que
 * dependia das rotas /perfil/me/*, inexistentes no projeto novo — construi-las
 * seria pos-login, fora do escopo. Como o escopo aqui e "telas publicas
 * (pre-login)", o estado deslogado e justamente a referencia visual.
 *
 * A logica de auth antiga (cookies app.access_token, isAuthenticate, logout)
 * NAO foi portada: o projeto novo usa Supabase Auth.
 */
export function Sticky({ inside = false }: { inside?: boolean }) {
  const [small, setSmall] = useState(false);
  const [pressed, setPressed] = useState(false);
  // 0 no primeiro render (server e client) para nao dar hydration mismatch.
  // O antigo tinha o mesmo efeito: innerWidth comecava '' e '' < 980 e true,
  // entao a logo colorida era a do primeiro paint tambem la.
  const [innerWidth, setInnerWidth] = useState(0);

  useEffect(() => {
    setInnerWidth(window.innerWidth);
    setSmall(window.scrollY > 0);

    const aoRolar = () => setSmall(window.scrollY > 0);
    const aoRedimensionar = () => setInnerWidth(window.innerWidth);

    window.addEventListener("scroll", aoRolar);
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, []);

  const logo =
    small || inside || innerWidth < 980 ? "/static/logo.svg" : "/static/logo_cinza.svg";

  return (
    <div
      id="sticky"
      className={[styles.sticky, small && styles.small, inside && styles.inside]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`container ${pressed ? "collapse" : ""}`}>
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} id="logo-header" alt="Logotipo SigoClínica" />
        </Link>

        <Anticon
          className="hamburguerBtn"
          onClick={() => setPressed((v) => !v)}
          style={{
            fontSize: "25px",
            color: pressed ? "rgb(40, 210, 150)" : "#76beac",
            backgroundColor: pressed ? "rgb(146, 146, 146, .2)" : "white",
            padding: "10px",
            borderRadius: "50%",
            transition: ".5s",
          }}
        >
          <IconeMenu />
        </Anticon>

        <div className="headerNavBar">
          <div className="socialMediaContainer d-inline-block">
            <a
              href="https://blogsigoclinicas.com.br/"
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              <div className="buttonContainer">
                <p>Blog</p>
              </div>
            </a>
          </div>

          {/* No antigo isto levava a /landingpage. O fluxo de cadastro de
              clinica e decisao futura da cliente: botao identico, porem inerte. */}
          <EmBreve como="button" className="button">
            Cadastrar Clínica
          </EmBreve>

          <Link href="/login" className="signNav link">
            Entrar / Registrar
          </Link>
        </div>
      </div>
    </div>
  );
}
