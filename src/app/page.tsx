import type { Metadata } from "next";

import { ClinicasSlider } from "@/components/publico/clinicas-slider";
import { ComoFunciona } from "@/components/publico/como-funciona";
import { CookieBanner } from "@/components/publico/cookie-banner";
import { Hero } from "@/components/publico/hero";
import { IconeAndroid, IconeApple } from "@/components/publico/icones";
import { PublicShell } from "@/components/publico/public-shell";
import estilos from "@/components/publico/home.module.css";
import {
  clinicasDestaque,
  listarCidades,
  listarEspecialidades,
} from "@/lib/marketplace";

// SSR dinâmico (lê sessão/cookies via createClient). Indexável (sem noindex).
export const dynamic = "force-dynamic";

// Título verbatim do <Head> do pages/index.js antigo.
export const metadata: Metadata = {
  title: "SigoClínicas - Encontre e agende o serviço de saúde mais perto de você",
  description:
    "Marketplace de clínicas médicas, estéticas, odontológicas e de terapias. Busque por cidade e especialidade e agende online.",
};

/**
 * A7 — marketplace multi-clínica público.
 *
 * Reskin visual: porte fiel do HomeComponent do sistema antigo
 * (repositorio-antigo/sigo-clinicas-www). Estrutura, textos e ordem das seções
 * são verbatim.
 *
 * Os dados continuam vindo do marketplace NOVO (Supabase + RLS). Nenhuma
 * chamada ao backend antigo (services/api.js, axios, PHP) foi reintroduzida:
 * o carrossel que fazia `api.get('/clinicas?page_size=8')` agora recebe
 * clinicasDestaque(8), e o form do hero faz GET para a /buscar nova.
 *
 * REMOVIDO NESTE PORTE (decisão da liderança, registrado para repactuação):
 * a seção "Quer ajuda para encontrar a clínica ideal?" com o <LeadForm>
 * (captação de lead, S3-8). O HomeComponent antigo não tem nada equivalente e
 * a decisão foi por fidelidade pura. Consequência: `src/components/marketplace/
 * lead-form.tsx` e a rota `POST /api/publico/lead` continuam no código, porém
 * SEM nenhum ponto de entrada — a home era o único. A captação de lead do
 * marketplace fica inativa até que se decida onde realocá-la.
 */
export default async function Home() {
  const [destaques, cidades, especialidades] = await Promise.all([
    // o antigo pedia /clinicas?page_size=8
    clinicasDestaque(8),
    listarCidades(),
    listarEspecialidades(),
  ]);

  return (
    <PublicShell>
      <CookieBanner />
      <Hero cidades={cidades} especialidades={especialidades} />

      <main className={estilos.conteudo}>
        <div className="carousel">
          <div className="container">
            <ClinicasSlider clinicas={destaques} />
          </div>
        </div>

        <div className="app-box">
          <div className="container">
            <div className="text">
              <h2>
                Manter o ritmo de vida e ainda cuidar da saúde é tudo que o Sigo
                Clínicas faz por você!
              </h2>
              {/* O antigo punha só <i class="fab fa-apple"> e deixava o Font
                  Awesome (CDN, v5.5.0) desenhar o glifo. Mantemos o <i> — é ele
                  que o CSS posiciona — com o SVG original da mesma versão
                  dentro, em 1em, sem depender de CDN. */}
              <a href="#" className="btn-app">
                <i className="fab fa-apple">
                  <IconeApple />
                </i>
                <span>App Store</span>
                <small>Disponível Agora</small>
              </a>
              <a href="#" className="btn-app">
                <i className="fab fa-android">
                  <IconeAndroid />
                </i>
                <span>Google Play</span>
                <small>Acesse Agora</small>
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/static/app.png"
              alt="Mão segurando um iPhone com o APP SigoClínicas"
            />
          </div>
        </div>

        <div className="how-it-works">
          <div className="container">
            <p className="title">Como Funciona?</p>
            <p className="description">
              Em nossa ferramenta de busca basta indicar para qual especialidade
              deseja encontrar atendimento, ou simplesmente digite sua localização
              para buscarmos os profissionais de saúde mais próximos de você.
            </p>
            <ComoFunciona />
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
