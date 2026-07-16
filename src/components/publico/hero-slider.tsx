"use client";

import Slider from "react-slick";

import styles from "./sliders.module.css";

// CSS ORIGINAL do slick. O pacote slick-carousel@1.8.1 e exatamente a versao que
// o repo antigo usava, e conferimos por diff que estes dois arquivos sao
// identicos ao static/slick/ do legado (so diferiam CRLF/LF).
// So o CSS e importado — o JS do slick (e o jquery que ele pede) nunca entra:
// o react-slick e uma reimplementacao React, sem jquery.
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

/**
 * Porte de repositorio-antigo/sigo-clinicas-www/components/HeroSlider.js.
 * `settings` e as duas imagens sao verbatim do original.
 */
export function HeroSlider() {
  const settings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: false,
    autoplay: true,
  };

  return (
    <Slider {...settings}>
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.imagem} src="/static/dentista.jpg" alt="Dentista" />
      </div>
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.imagem} src="/static/pacient.jpg" alt="Paciente" />
      </div>
    </Slider>
  );
}
