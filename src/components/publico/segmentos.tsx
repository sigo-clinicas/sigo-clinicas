"use client";

import { useRouter } from "next/navigation";

/**
 * Os 3 botoes de segmento do hero. Markup verbatim do HomeComponent antigo,
 * inclusive os estilos inline dos <h2> — eles existem porque a regra
 * `.options-list li a` do CSS antigo NUNCA casava: o <Link> do Next 7 nao
 * injetava ancora em filhos que nao fossem <a>, entao o que ia pro DOM era o
 * <button>. Trocar por <a> ativaria aquela regra e dobraria o espacamento.
 *
 * Por isso navegamos com router.push num <button>, exatamente como o antigo
 * fazia (o Next 7 so pendurava um onClick no botao).
 *
 * Destino: o antigo ia para /{especialidade}/{cidade}/{idsegmento} com
 * idsegmento 1|2|3. O /buscar novo filtra por clinica.tipo (decisao da
 * lideranca), entao mapeamos 1->odontologica, 2->medica, 3->estetica.
 *
 * Mantidos os 3 do antigo. O catalogo novo tem um 4o segmento (Terapias), fora
 * do hero de proposito: incluir mudaria larguras, divisorias e espacamento, e
 * nao existe icone original para ele no repo antigo.
 */
const SEGMENTOS = [
  { tipo: "odontologica", rotulo: "Odontologia" },
  { tipo: "medica", rotulo: "Medicina" },
  { tipo: "estetica", rotulo: "Saúde e Estética" },
];

export function Segmentos() {
  const router = useRouter();

  return (
    <ul className="options-list">
      {SEGMENTOS.map((s) => (
        <li key={s.tipo}>
          <button
            style={{ border: "0", background: "none" }}
            onClick={() => router.push(`/buscar?tipo=${s.tipo}`)}
          >
            <div>
              <h2 style={{ padding: "0 20px", marginTop: "70px" }}>{s.rotulo}</h2>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
