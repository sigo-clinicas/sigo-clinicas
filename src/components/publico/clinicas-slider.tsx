"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Slider from "react-slick";

import type { ClinicaPublica } from "@/lib/marketplace";
import { urlLogoPublica } from "@/lib/tipo-clinica";
import { rotuloNivel } from "@/lib/destaque";
import styles from "./sliders.module.css";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

/**
 * Porte de repositorio-antigo/sigo-clinicas-www/components/ClinicasSlider.js.
 * `settings`, markup e o estado vazio ("Seja bem vindo a Sigo Clinicas") sao
 * verbatim do original.
 *
 * O que muda e SO a origem dos dados: o antigo fazia
 * `api.get('/clinicas?page_size=8')` contra o backend PHP. Aqui as clinicas
 * chegam prontas por prop, vindas de clinicasDestaque(8) (Supabase + RLS), e
 * o link vai para a rota nova /clinica/[slug] no lugar de /detalhes/...
 */
export function ClinicasSlider({ clinicas }: { clinicas: ClinicaPublica[] }) {
  // 0 no primeiro render (server e client) para nao dar hydration mismatch. O
  // antigo tinha o mesmo efeito: innerWidth comecava '' e '' < 980 e true.
  const [innerWidth, setInnerWidth] = useState(0);

  useEffect(() => {
    setInnerWidth(window.innerWidth);
    const aoRedimensionar = () => setInnerWidth(window.innerWidth);
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  const settings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: innerWidth < 980 ? 1 : 4,
    slidesToScroll: 1,
    arrows: false,
    autoplay: false,
  };

  if (clinicas.length === 0) {
    return (
      <Slider {...settings}>
        <div>
          <h2 style={{ textAlign: "center" }}>
            Seja bem vindo a <br />
            Sigo Clínicas
          </h2>
        </div>
      </Slider>
    );
  }

  return (
    <Slider {...settings}>
      {clinicas.map((clinica) => {
        const logo = urlLogoPublica(clinica.logo_path);
        const local = [clinica.cidade, clinica.uf].filter(Boolean).join(" - ");
        const selo = rotuloNivel(clinica.nivel);
        return (
          <div className={`card ${styles.card}`} key={clinica.id}>
            {selo && <span className={styles.selo} data-nivel={clinica.nivel}>{selo}</span>}
            <Link href={clinica.slug ? `/clinica/${clinica.slug}` : "#"}>
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={`Logotipo ${clinica.nome}`} />
              ) : (
                // O antigo assumia que toda clinica tinha logotipo e renderizava
                // <img> direto — sem logo, apareceria o icone de imagem
                // quebrada. Aqui a mesma caixa 140x80 recebe a inicial.
                <span className={styles.semLogo} aria-hidden="true">
                  {clinica.nome.charAt(0).toUpperCase()}
                </span>
              )}
              <h3>{clinica.nome}</h3>
              {/* O antigo mostrava "logradouro, no X" e "cidade - numero" (o
                  segundo e um bug: repetia o numero no lugar do estado). A view
                  marketplace_clinica nao expoe logradouro/numero — expandi-la
                  seria mexer no banco. Usamos bairro e "cidade - uf", que e o
                  que o card pretendia mostrar. */}
              <address>
                {clinica.bairro}
                {clinica.bairro && <br />}
                {local}
              </address>
            </Link>
          </div>
        );
      })}
    </Slider>
  );
}
