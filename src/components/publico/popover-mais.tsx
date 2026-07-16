"use client";

import { useState } from "react";

import styles from "./busca.module.css";

/**
 * "+N" do resumo (h2) que, ao passar o mouse, mostra as cidades/especialidades
 * restantes num balao — reproduz o <Popover placement="bottom"> do antigo
 * (returnCityPopover / returnSpecialityPopover, index.js:469-517).
 *
 * So deve ser renderizado quando ha itens extras (o antigo so montava o "+N"
 * com length > 1). O gatilho e o texto "+N".
 */
export function PopoverMais({ rotulo, itens }: { rotulo: string; itens: string[] }) {
  const [aberto, setAberto] = useState(false);

  return (
    <span
      className={styles.popoverGatilho}
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
    >
      {rotulo}
      {aberto && (
        <span className={styles.popover} role="tooltip">
          <span className={styles.popoverSeta} />
          <span className={styles.popoverInner}>
            {itens.map((it) => (
              <p key={it}>{it}</p>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
