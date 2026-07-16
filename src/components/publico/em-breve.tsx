"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./em-breve.module.css";

/**
 * Controle visualmente identico ao do site antigo, porem inerte: ao clicar,
 * mostra um balao "Em breve" em vez de navegar.
 *
 * Usado onde o visual antigo tem um destino que o projeto novo nao possui e
 * que nao vamos construir agora (decisao da lideranca):
 *   - "Cadastrar Clinica" (o antigo levava a /landingpage, pagina B2B fora do
 *     escopo; o fluxo de cadastro de clinica e decisao futura da cliente)
 *   - "Registre-se" / "Cadastro" (auto-cadastro de paciente criaria superficie
 *     nova de backend)
 *   - "Nossa Solucao", "Divulgar clinica" (rodape)
 *
 * `como` existe porque o markup antigo usa elementos diferentes em cada lugar,
 * e o CSS portado depende disso: no header o seletor e `.container div .button`
 * e no rodape e `.grid ul li a`. Trocar a tag quebraria o estilo.
 */
export function EmBreve({
  como,
  className,
  children,
  aviso = "Em breve",
}: {
  como: "button" | "a";
  className?: string;
  children: React.ReactNode;
  aviso?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!aberto) return;

    const aoClicarFora = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const conteudo = (
    <>
      {children}
      {aberto && (
        <span className={styles.balao} role="status">
          {aviso}
        </span>
      )}
    </>
  );

  const comuns = {
    className: [className, styles.gatilho].filter(Boolean).join(" "),
    "aria-disabled": true as const,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      setAberto((v) => !v);
    },
  };

  if (como === "a") {
    // <a> sem href: nao navega e nao entra na ordem de tabulacao por si so —
    // por isso o role/tabIndex explicitos.
    return (
      <a
        {...comuns}
        ref={ref as React.RefObject<HTMLAnchorElement>}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setAberto((v) => !v);
          }
        }}
      >
        {conteudo}
      </a>
    );
  }

  return (
    <button {...comuns} ref={ref as React.RefObject<HTMLButtonElement>} type="button">
      {conteudo}
    </button>
  );
}

/**
 * Variante para uma AREA (nao um controle): envolve um widget visualmente
 * completo mas sem funcao (os filtros Data e Preco da busca). O widget aparece
 * normal; qualquer clique/interacao na area mostra o balao "Em breve" em vez de
 * agir. Usa a mesma pele de balao do EmBreve.
 */
export function EmBreveArea({
  children,
  aviso = "Em breve",
}: {
  children: React.ReactNode;
  aviso?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div
      ref={ref}
      className={styles.gatilho}
      aria-disabled
      // captura o clique antes de chegar ao widget interno (que e inerte de
      // qualquer forma) e alterna o balao
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setAberto((v) => !v);
      }}
    >
      {children}
      {aberto && (
        <span className={styles.balao} role="status">
          {aviso}
        </span>
      )}
    </div>
  );
}
