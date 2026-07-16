"use client";

import { useId, useState } from "react";

import { IconeDireita } from "./icones";

/**
 * Reimplementa o <Collapse><Panel> do antd 3 usado no aside da busca, emitindo
 * exatamente as classes .ant-collapse* das quais busca.module.css depende.
 *
 * Cada filtro do aside antigo era um <Collapse> independente com um Panel — e
 * todos comecavam FECHADOS (nenhum defaultActiveKey). Reproduzimos isso: o
 * estado inicial e fechado, e o clique no header alterna.
 *
 * A seta e o RightOutlined (o mesmo icone do antd); o CSS a rotaciona 90deg
 * quando o item esta ativo.
 */
export function Colapso({
  header,
  children,
  aberto: abertoInicial = false,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  aberto?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const idConteudo = useId();

  return (
    <div className="ant-collapse ant-collapse-icon-position-left">
      <div className={`ant-collapse-item${aberto ? " ant-collapse-item-active" : ""}`}>
        <div
          className="ant-collapse-header"
          role="button"
          tabIndex={0}
          aria-expanded={aberto}
          aria-controls={idConteudo}
          onClick={() => setAberto((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setAberto((v) => !v);
            }
          }}
        >
          <span className="ant-collapse-arrow">
            <IconeDireita />
          </span>
          {header}
        </div>
        <div
          id={idConteudo}
          className={`ant-collapse-content ${
            aberto ? "ant-collapse-content-active" : "ant-collapse-content-inactive"
          }`}
        >
          <div className="ant-collapse-content-box">{children}</div>
        </div>
      </div>
    </div>
  );
}
