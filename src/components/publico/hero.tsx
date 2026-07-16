import type { EspecialidadeOpcao } from "@/lib/marketplace";

import { HeroSlider } from "./hero-slider";
import { IconeSeta } from "./icones";
import { Segmentos } from "./segmentos";
import styles from "./home.module.css";

/**
 * Porte do <Hero> do HomeComponent antigo. Estrutura, textos e ordem do DOM
 * verbatim — inclusive `.opacity` vindo depois de `.center` e o slider por
 * ultimo (estatico, por isso pinta abaixo dos dois).
 *
 * A busca: o antigo montava a URL /{especialidade}/{cidade}/{segmento} no
 * cliente e navegava via <Link>. Aqui e um <form method="get" action="/buscar">
 * nativo, entao funciona sem JS e continua consumindo o marketplace novo
 * (Supabase) pela propria pagina /buscar.
 */
export function Hero({
  cidades,
  especialidades,
}: {
  cidades: string[];
  especialidades: EspecialidadeOpcao[];
}) {
  // agrupa por segmento, como a /buscar ja faz
  const porSegmento = new Map<string, EspecialidadeOpcao[]>();
  for (const e of especialidades) {
    const k = e.segmento ?? "Outras";
    porSegmento.set(k, [...(porSegmento.get(k) ?? []), e]);
  }

  return (
    <header className={styles.hero}>
      <div className="center">
        <div className="container">
          <h1>Encontre e agende o serviço de saúde mais perto de você</h1>

          <form method="get" action="/buscar" className="login-form">
            <div className={styles.campo}>
              <div className={styles.caixaSelect}>
                <select
                  name="especialidade"
                  defaultValue=""
                  aria-label="Especialidades"
                  className={`${styles.select} ${styles.especialidade}`}
                >
                  <option value="">Especialidades</option>
                  {[...porSegmento.entries()].map(([seg, lista]) => (
                    <optgroup key={seg} label={seg}>
                      {lista.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <IconeSeta className={styles.seta} />
              </div>
            </div>

            <div className={styles.campo}>
              <div className={styles.caixaSelect}>
                <select
                  name="cidade"
                  defaultValue=""
                  aria-label="Selecione a cidade"
                  className={`${styles.select} ${styles.cidade}`}
                >
                  <option value="">Selecione a cidade</option>
                  {cidades.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <IconeSeta className={styles.seta} />
              </div>
            </div>

            <button type="submit" aria-label="Buscar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/static/search.svg" alt="Ícone de busca" />
            </button>
          </form>

          <h2>Todos os serviços no mesmo lugar</h2>
          <Segmentos />
        </div>
      </div>
      <div className="opacity" />
      <div className="hero-slider-container">
        <HeroSlider />
      </div>
    </header>
  );
}
