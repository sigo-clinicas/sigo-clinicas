"use client";

/**
 * Reimplementa o <Checkbox.Group> do antd 3 do aside, emitindo o DOM
 * .ant-checkbox* que busca.module.css estiliza.
 *
 * Multi-selecao (decisao da lideranca): marcar/desmarcar acumula em `valor` e
 * chama `onChange` com a lista. A pagina /buscar reescreve a querystring a
 * partir disso e o SSR refaz o filtro.
 */
export type OpcaoCheckbox = { label: string; value: string };

export function CaixaCheckbox({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: OpcaoCheckbox[];
  valor: string[];
  onChange: (novo: string[]) => void;
}) {
  const alternar = (v: string) => {
    onChange(valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v]);
  };

  return (
    <div className="ant-checkbox-group">
      {opcoes.map((op) => {
        const marcado = valor.includes(op.value);
        return (
          <label
            key={op.value}
            className={`ant-checkbox-wrapper${marcado ? " ant-checkbox-wrapper-checked" : ""}`}
          >
            <span className={`ant-checkbox${marcado ? " ant-checkbox-checked" : ""}`}>
              <input
                type="checkbox"
                className="ant-checkbox-input"
                checked={marcado}
                onChange={() => alternar(op.value)}
              />
              <span className="ant-checkbox-inner" />
            </span>
            <span>{op.label}</span>
          </label>
        );
      })}
    </div>
  );
}
