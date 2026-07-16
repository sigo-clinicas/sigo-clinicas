import Link from "next/link";

import { Anticon } from "./anticon";
import { EmBreve } from "./em-breve";
import {
  IconeFacebook,
  IconeInstagram,
  IconeLinkedin,
  IconeYoutube,
} from "./icones";
import styles from "./footer.module.css";

/**
 * Porte de repositorio-antigo/sigo-clinicas-www/components/Footer.
 * Textos, ordem das colunas, links sociais e endereco sao verbatim do antigo.
 *
 * Destinos que o projeto novo nao tem e que nao vamos construir (decisao da
 * lideranca) viram EmBreve, mantendo o item visivel e no lugar:
 *   - "Nossa Solucao" -> /landingpage (pagina B2B, fora do escopo)
 *   - "Divulgar clinica" -> #contact-form (form da /landingpage)
 *   - "Cadastro" -> /cadastro (auto-cadastro de paciente = backend novo)
 *
 * /termos, /lgpd, /privacidade e /cookies sao portadas na fase 7.
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className="grid">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/static/logo.svg" alt="Logotipo SigoClínica" />
          <p className="description">
            Você e seus profissional de saúde mais conectados!
          </p>
        </div>

        <div className="grid">
          <p className="title">Sigo Clínicas</p>
          <ul>
            <li>
              <EmBreve como="a">Nossa Solução</EmBreve>
            </li>
            <li>
              <Link href="/">Clínicas</Link>
            </li>
            <li>
              <EmBreve como="a">Divulgar clínica</EmBreve>
            </li>
          </ul>
        </div>

        <div className="grid">
          <p className="title">Redes Sociais</p>
          <ul>
            <li>
              <a
                href="https://www.facebook.com/Sigo-Clinicas-679937732436755/"
                target="_blank"
                rel="noreferrer"
              >
                <Anticon className="social_media_icon">
                  <IconeFacebook />
                </Anticon>
              </a>
              <a
                href="https://www.linkedin.com/company/sigoclinicas/"
                target="_blank"
                rel="noreferrer"
              >
                <Anticon className="social_media_icon">
                  <IconeLinkedin />
                </Anticon>
              </a>
              <a
                href="https://www.youtube.com/channel/UCvAb3wUleT8bnf0f4i1oX9Q"
                target="_blank"
                rel="noreferrer"
              >
                <Anticon className="social_media_icon">
                  <IconeYoutube />
                </Anticon>
              </a>
              <a
                href="https://www.instagram.com/sigoclinicas/"
                target="_blank"
                rel="noreferrer"
              >
                <Anticon className="social_media_icon">
                  <IconeInstagram />
                </Anticon>
              </a>
            </li>
          </ul>
        </div>

        <div className="grid">
          <p className="title">Links Úteis</p>
          <ul>
            <li>
              <Link href="/login">Entrar</Link>
            </li>
            <li>
              <EmBreve como="a">Cadastro</EmBreve>
            </li>
            <li>
              <Link href="/termos">Termos de uso</Link>
            </li>
            <li>
              <Link href="/lgpd">Termos de Consentimento - LGPD</Link>
            </li>
            <li>
              <Link href="/privacidade">Política de privacidade</Link>
            </li>
            <li>
              <Link href="/cookies">Política de cookies</Link>
            </li>
          </ul>
        </div>

        <div className="grid">
          <p className="title">Fale Conosco</p>
          <address>
            <p>
              Rua Anásia José Bolçone, 710 – Pq. São Miguel, CEP 15.057-512, São
              José do Rio Preto - SP
            </p>
            <p>(17) 3353-3013</p>
            <p>contato@sigoclinicas.com.br</p>
          </address>
        </div>
      </div>
      <div className="bottom">
        <p>2018 Sigo Clínicas</p>
      </div>
    </footer>
  );
}
