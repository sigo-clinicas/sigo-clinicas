import Link from "next/link";

import type { ClinicaPublica } from "@/lib/marketplace";
import { urlLogoPublica } from "@/lib/tipo-clinica";
import { IconeMapa, IconeMaleta } from "./icones";
import styles from "./busca.module.css";

/**
 * Card de resultado da busca. Porte do <CardClinica> antigo (index.js:625-766).
 *
 * Diferente do src/components/marketplace/clinica-card.tsx (Tailwind, usado na
 * home) — este reproduz o visual do sistema antigo.
 *
 * Omitido (decisao da lideranca): o bloco `.body` "Servicos" (Collapse com
 * preco por servico + grade de horarios). No antigo ele ja nascia fechado, entao
 * some so a linha "Servicos"; o resto do card fica identico. O agendamento vive
 * no fluxo novo /clinica/[slug]/agendar.
 *
 * Endereco: so bairro - cidade - uf (decisao da lideranca). A view do
 * marketplace nao expoe logradouro/numero de proposito, e o prefixo "Av. Dr."
 * hardcoded do antigo era bug (saia grudado no logradouro) — dropado.
 */
export function CardClinicaBusca({
  clinica,
  especialidades,
}: {
  clinica: ClinicaPublica;
  especialidades: string[];
}) {
  const logo = urlLogoPublica(clinica.logo_path);
  const href = clinica.slug ? `/clinica/${clinica.slug}` : "#";
  const endereco = [clinica.bairro, clinica.cidade, clinica.uf].filter(Boolean).join(" - ");

  return (
    <div className={styles.cardClinica}>
      <div className="head">
        <Link href={href} className="logo">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={`Logotipo ${clinica.nome}`} />
          ) : null}
        </Link>
        <div className="description">
          <h3>
            <Link href={href}>{clinica.nome}</Link>
          </h3>
          {endereco && (
            <address>
              <i className="fas fa-map-marker-alt">
                <IconeMapa />
              </i>{" "}
              {endereco}
            </address>
          )}
          {especialidades.length > 0 && (
            <p className="specialties">
              <i className="fas fa-briefcase-medical">
                <IconeMaleta />
              </i>{" "}
              {especialidades.join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
