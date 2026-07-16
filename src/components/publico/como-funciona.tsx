"use client";

import { useState } from "react";

/**
 * Porte da secao "Como Funciona?" do HomeComponent antigo. Textos, icones e
 * imagens verbatim.
 *
 * O original manipulava o DOM na mao (historyOver: querySelectorAll + add/remove
 * de classe + setAttribute('src')). Aqui e estado do React — mesmo efeito
 * observavel: passar o mouse marca o passo como .active (titulo azul) e troca a
 * imagem da direita.
 */
const PASSOS = [
  {
    img: "img_slide_1",
    icone: "/static/icon_buscar.png",
    titulo: "Busque pelo site ou aplicativo",
    texto: "Você faz a busca por especialidade ou cidade no site do Sigo Clinicas.",
  },
  {
    img: "img_slide_2",
    icone: "/static/icon_escolha.png",
    titulo: "Escolha a clínica e os profissionais",
    texto: "Escolhe um estabelecimento dentre as opções sugeridas pelo site.",
  },
  {
    img: "img_slide_3",
    icone: "/static/icon_agende.png",
    titulo: "Agende seu horário",
    texto:
      "Já no site da clinica escolhe o profissional e vê os horários disponíveis em sua agenda, faz o cadastro ou login e pronto, está agendado! Fácil rápido e sem complicação!",
  },
];

export function ComoFunciona() {
  const [ativo, setAtivo] = useState(0);

  return (
    <div className="steps">
      <div>
        {PASSOS.map((passo, i) => (
          <div
            key={passo.img}
            className={`history ${i === ativo ? "active" : ""}`}
            onMouseOver={() => setAtivo(i)}
          >
            <i>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={passo.icone} alt="" />
            </i>
            <div className="info">
              <p>{passo.titulo}</p>
              <p>{passo.texto}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="box-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="history-img"
          src={`/static/${PASSOS[ativo].img}.png`}
          alt=""
        />
      </div>
    </div>
  );
}
