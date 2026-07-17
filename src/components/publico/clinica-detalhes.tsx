import Link from "next/link";

import type { PaginaClinica } from "@/lib/marketplace";
import { urlLogoPublica } from "@/lib/tipo-clinica";
import { rotulosFormasPagamento } from "@/lib/formas-pagamento";
import { formatarHorarios } from "@/lib/horario";
import { PublicShell } from "./public-shell";
import { IconeMapa } from "./icones";
import styles from "./detalhes.module.css";

type Aba = "informacoes" | "servicos" | "profissionais";

/**
 * Moldura da página da clínica: header-banner + menu de 4 abas, dentro do
 * PublicShell. Porte do DetalhesComponent antigo (index.js:481-518). As abas
 * são sub-rotas (/clinica/[slug], /servicos, /profissionais, /agendar).
 */
export function ClinicaShell({
  nome,
  slug,
  aba,
  children,
}: {
  nome: string;
  slug: string;
  aba: Aba;
  children: React.ReactNode;
}) {
  const cls = (a: Aba | "agendar") => (a === aba ? "active" : undefined);
  return (
    <PublicShell inside>
      <header className={styles.header}>
        <h1 className="clinic-name">{nome}</h1>
      </header>
      <main className={styles.detalhes}>
        <div className="container">
          <ul className="menu">
            <li>
              <Link href={`/clinica/${slug}`} className={cls("informacoes")}>
                Informações
              </Link>
            </li>
            <li>
              <Link href={`/clinica/${slug}/agendar`} className={cls("agendar")}>
                Agende seu horário
              </Link>
            </li>
            <li>
              <Link href={`/clinica/${slug}/servicos`} className={cls("servicos")}>
                Serviços
              </Link>
            </li>
            <li>
              <Link href={`/clinica/${slug}/profissionais`} className={cls("profissionais")}>
                Profissionais
              </Link>
            </li>
          </ul>
        </div>
        {children}
      </main>
    </PublicShell>
  );
}

/**
 * Aba Informações. Porte de index.js:519-659.
 * S2 — religados: carrossel de fotos, endereço completo e formas de pagamento.
 * Ainda omitido (lacuna de dado): funcionalidades, especialidades, segmentos,
 * horário de funcionamento (S5). Avaliações mantidas (feature nova, visual antigo).
 */
export function AbaInformacoes({ dados }: { dados: PaginaClinica }) {
  const { clinica, depoimentos } = dados;
  const horarios = formatarHorarios(dados.horarios);
  const logo = urlLogoPublica(clinica.logo_path) ?? "/static/logo_icon.png";
  const fotos = (clinica.fotos ?? [])
    .map((p) => urlLogoPublica(p))
    .filter((u): u is string => Boolean(u));
  // endereço completo: "Logradouro, nº compl — Bairro, Cidade - UF"
  const linha1 = [clinica.logradouro, clinica.numero].filter(Boolean).join(", ");
  const linha1c = [linha1, clinica.complemento].filter(Boolean).join(" ");
  const linha2 = [clinica.bairro, clinica.cidade, clinica.uf].filter(Boolean).join(", ");
  const endereco = [linha1c, linha2].filter(Boolean).join(" — ");
  const formas = rotulosFormasPagamento(clinica.formas_pagamento);

  return (
    <div className="container">
      <div className="left-content">
        {fotos.length > 0 && (
          <div className={styles.galeria} aria-label="Fotos da clínica">
            {fotos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} className={styles.galeriaFoto} src={src} alt={`${clinica.nome} — foto ${i + 1}`} />
            ))}
          </div>
        )}

        <p className="title">Sobre a clínica</p>
        <p className="description">{clinica.sobre ?? "—"}</p>

        {formas.length > 0 && (
          <>
            <p className="title">Formas de pagamento</p>
            <ul className={styles.formasPagamento}>
              {formas.map((f) => (
                <li key={f} className={styles.formaPagamento}>
                  {f}
                </li>
              ))}
            </ul>
          </>
        )}

        {depoimentos.length > 0 && (
          <>
            <p className="title">Avaliações</p>
            <div className={styles.depoimentos}>
              {depoimentos.map((d) => (
                <div key={d.id} className={styles.depoimento}>
                  {d.nota != null && (
                    <div className={styles.estrelas} aria-label={`${d.nota} de 5`}>
                      {"★".repeat(d.nota)}
                      <span className={styles.estrelasVazias}>{"★".repeat(5 - d.nota)}</span>
                    </div>
                  )}
                  <p className={styles.depoimentoTexto}>{d.texto}</p>
                  <p className={styles.depoimentoAutor}>— {d.paciente_nome}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="right-content">
        <div className="infos-clinic">
          <div className="img-clinic">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="border-circle" src={logo} width="200" height="200" alt={clinica.nome} />
            <h2 className="clinic-name">{clinica.nome}</h2>

            {clinica.telefone && (
              <>
                <p className="m-t-10 m-b-0">Telefone:</p>
                <p className="m-t-0 m-b-0 tel">
                  <strong>{clinica.telefone}</strong>
                </p>
              </>
            )}

            {endereco && (
              <>
                <p className="m-t-10 m-b-0">Endereço:</p>
                <address>
                  <i className="fas fa-map-marker-alt">
                    <IconeMapa />
                  </i>{" "}
                  <strong>{endereco}</strong>
                  {clinica.cep && <span className={styles.cep}>CEP {clinica.cep}</span>}
                </address>
              </>
            )}

            {horarios.length > 0 && (
              <>
                <p className="m-t-10 m-b-0">Horário de funcionamento:</p>
                <ul className={styles.horarios}>
                  {horarios.map((h) => (
                    <li key={h.dia} className={styles.horarioLinha}>
                      <span className={styles.horarioDia}>{h.dia}</span>
                      <span className={styles.horarioIntervalo}>{h.intervalo}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Aba Serviços. Porte de index.js:661-735.
 * S3 — rótulo de preço determinístico (@/lib/preco, reproduz o viewPreco sem os
 * 2 defeitos) e duração do serviço. Omitido: filtro por categoria (o marketplace
 * não expõe categoria); `.service-img` usa o ícone fixo do antigo.
 */
export function AbaServicos({ dados, slug }: { dados: PaginaClinica; slug: string }) {
  const { servicos } = dados;
  return (
    <div className="container">
      <div className="left-content">
        <h2>Lista de serviços</h2>
        {servicos.length > 0 ? (
          servicos.map((s) => (
            <div className="service" key={s.id}>
              <div className="service-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/static/logo_icon.png" alt="" />
              </div>
              <div className="service-description">
                <div className="top-info">
                  <Link href={`/clinica/${slug}/agendar`}>
                    <p className="service-name">{s.nome}</p>
                  </Link>
                </div>
                <p className="service-time">
                  {s.precoLabel}
                  {s.duracao_minutos != null && (
                    <span className={styles.duracao}> · {s.duracao_minutos} min</span>
                  )}
                </p>
                {s.descricao && <p className="service-text">{s.descricao}</p>}
              </div>
            </div>
          ))
        ) : (
          <div className={styles.vazio}>Nenhum serviço encontrado para essa clínica!</div>
        )}
      </div>
    </div>
  );
}

/**
 * Aba Profissionais. Porte de index.js:737-810.
 * S2 — foto real do profissional (foto_path, bucket público `logos`), com
 * fallback user.svg. Omitido: Modal/botão "Horários" (agendamento inline ->
 * /agendar) e os chips de especialidade (lacuna).
 */
export function AbaProfissionais({ dados }: { dados: PaginaClinica }) {
  const { profissionais } = dados;
  return (
    <div className="container">
      {profissionais.length > 0 ? (
        <ul className="professionals-list">
          {profissionais.map((p) => (
            <li key={p.id}>
              <div className="img-professional">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlLogoPublica(p.foto_path) ?? "/static/user.svg"} alt={p.nome} />
              </div>
              <div className="card-infos">
                <h3 className="name-professional">{p.nome}</h3>
                {p.numero_registro && (
                  <div className="registro">
                    <span>
                      {String(p.nome_conselho ?? "").toUpperCase()}: {p.numero_registro}
                    </span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.vazio}>Nenhum profissional cadastrado nesta clínica.</div>
      )}
    </div>
  );
}
