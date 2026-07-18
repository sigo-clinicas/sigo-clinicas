"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { CaixaCheckbox, type OpcaoCheckbox } from "./caixa-checkbox";
import { Colapso } from "./colapso";
import { EmBreveArea } from "./em-breve";
import { IconeCalendario } from "./icones";
import { chaveCidade } from "@/lib/busca";
import styles from "./busca.module.css";

/**
 * Aside de filtros da busca. Porte do <AsideBusca> antigo (index.js:549-606).
 *
 * Cidade e Especialidade: multi-select ligado (decisao da lideranca). Marcar/
 * desmarcar reescreve a querystring; a pagina (SSR) refaz o filtro. A busca
 * textual filtra so as OPCOES exibidas (searchCity/searchEspecialidade do
 * antigo), nao as clinicas.
 *
 * Data e Preco: visiveis, porem INERTES — clicar mostra "Em breve" (o
 * marketplace novo nao filtra por data nem preco). O visual reproduz o estado
 * que o site antigo mostrava: Data com amanha DD/MM/YYYY, Preco com o slider
 * colado na ponta esquerda (min=max=0).
 *
 * `tipo` (dos 3 botoes de segmento do hero) e preservado na URL, mas nao tem
 * widget — igual ao antigo, onde o segmento filtrava de forma invisivel.
 */
export function AsideBusca({
  cidades,
  especialidades,
  cidadesSelecionadas,
  especialidadesSelecionadas,
  tipo,
  dataAmanha,
}: {
  cidades: string[];
  especialidades: OpcaoCheckbox[];
  cidadesSelecionadas: string[];
  especialidadesSelecionadas: string[];
  tipo: string | null;
  dataAmanha: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [buscaCidade, setBuscaCidade] = useState("");
  const [buscaEsp, setBuscaEsp] = useState("");

  // busca das OPÇÕES acento/caixa-insensível (chaveCidade serve p/ ambas)
  const cidadesFiltradas = useMemo(() => {
    const q = chaveCidade(buscaCidade);
    return cidades
      .filter((c) => chaveCidade(c).includes(q))
      .map((c) => ({ label: c, value: c }));
  }, [cidades, buscaCidade]);

  const espFiltradas = useMemo(() => {
    const q = chaveCidade(buscaEsp);
    return especialidades.filter((e) => chaveCidade(e.label).includes(q));
  }, [especialidades, buscaEsp]);

  // reescreve a querystring preservando tipo; multi-valor = chave repetida
  const navegar = (novasCidades: string[], novasEsp: string[]) => {
    const params = new URLSearchParams();
    if (tipo) params.set("tipo", tipo);
    for (const c of novasCidades) params.append("cidade", c);
    for (const e of novasEsp) params.append("especialidade", e);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <aside className={styles.asideBusca}>
      <Colapso header="Cidade">
        <input
          type="text"
          placeholder="Buscar cidade"
          value={buscaCidade}
          onChange={(e) => setBuscaCidade(e.target.value)}
        />
        <div className="list-specialties">
          <CaixaCheckbox
            opcoes={cidadesFiltradas}
            valor={cidadesSelecionadas}
            onChange={(novo) => navegar(novo, especialidadesSelecionadas)}
          />
        </div>
      </Colapso>

      <Colapso header="Especialidade">
        <input
          type="text"
          placeholder="Buscar especialidade"
          value={buscaEsp}
          onChange={(e) => setBuscaEsp(e.target.value)}
        />
        <div className="list-specialties">
          <CaixaCheckbox
            opcoes={espFiltradas}
            valor={especialidadesSelecionadas}
            onChange={(novo) => navegar(cidadesSelecionadas, novo)}
          />
        </div>
      </Colapso>

      <Colapso header="Data disponível">
        <EmBreveArea>
          <div className="ant-calendar-picker">
            <input className="ant-input" readOnly value={dataAmanha} aria-disabled />
            <span className="ant-calendar-picker-icon">
              <IconeCalendario />
            </span>
          </div>
        </EmBreveArea>
      </Colapso>

      <Colapso header="Preço">
        <EmBreveArea>
          {/* estado que o site antigo mostrava: min=max=0 -> track de largura 0,
              os dois handles colados na ponta esquerda */}
          <div className="ant-slider">
            <div className="ant-slider-rail" />
            <div className="ant-slider-track" />
            <div className="ant-slider-handle" />
            <div className="ant-slider-handle" />
          </div>
        </EmBreveArea>
      </Colapso>
    </aside>
  );
}
