import type { Metadata } from "next";

import { AsideBusca } from "@/components/publico/aside-busca";
import { CardClinicaBusca } from "@/components/publico/card-clinica-busca";
import { PopoverMais } from "@/components/publico/popover-mais";
import { PublicShell } from "@/components/publico/public-shell";
import estilos from "@/components/publico/busca.module.css";
import {
  listarCidades,
  listarClinicas,
  listarEspecialidades,
} from "@/lib/marketplace";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SigoClínicas - Resultado das buscas",
  description: "Busque clínicas por cidade e especialidade e agende online.",
};

// aceita ?chave=a&chave=b (multi) ou ?chave=a (single) e normaliza para lista
function comoLista(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Busca pública (A7) — reskin do BuscaComponent antigo.
 *
 * Dados do marketplace NOVO (Supabase + RLS). Pipeline ÚNICO (o antigo tinha 3
 * motores que se atropelavam — não reproduzimos os bugs):
 *   1. listarClinicas() sem filtro (todas as públicas)
 *   2. mapa clinica_id -> especialidades, composto AQUI (sem tocar src/lib),
 *      igual ao precedente do filtro por tipo
 *   3. filtra por tipo (dos botões do hero) AND cidade (OR) AND especialidade (OR)
 *
 * O aside (client) só reescreve a querystring; o SSR refaz o filtro. URL
 * compartilhável, `tipo` preservado.
 *
 * Filtros Data e Preço: visíveis, porém inertes ("Em breve") — o marketplace
 * novo não filtra por data nem preço, e tocar o backend está fora do escopo.
 */
export default async function BuscarPage({
  searchParams,
}: {
  searchParams: {
    cidade?: string | string[];
    especialidade?: string | string[];
    tipo?: string;
  };
}) {
  const cidadesSel = comoLista(searchParams.cidade);
  const espSel = comoLista(searchParams.especialidade);
  const tipo = searchParams.tipo ?? null;

  const [todas, cidades, especialidades] = await Promise.all([
    listarClinicas(),
    listarCidades(),
    listarEspecialidades(),
  ]);

  // mapa clinica_id -> [especialidade_id] e id -> nome, compostos na página.
  // (a view do marketplace não expõe especialidades; a RLS anon lê estas duas.)
  const supabase = createClient();
  const [{ data: vinculos }, { data: nomes }] = await Promise.all([
    supabase.from("clinica_especialidade").select("clinica_id, especialidade_id"),
    supabase.from("especialidade").select("id, nome"),
  ]);

  const nomePorId = new Map((nomes ?? []).map((e) => [e.id, e.nome]));
  const espIdsPorClinica = new Map<string, string[]>();
  for (const v of vinculos ?? []) {
    espIdsPorClinica.set(v.clinica_id, [
      ...(espIdsPorClinica.get(v.clinica_id) ?? []),
      v.especialidade_id,
    ]);
  }

  // pipeline único: AND entre os grupos, OR dentro de cada grupo
  const clinicas = todas.filter((c) => {
    if (tipo && c.tipo !== tipo) return false;
    if (cidadesSel.length && !(c.cidade && cidadesSel.includes(c.cidade))) return false;
    if (espSel.length) {
      const ids = espIdsPorClinica.get(c.id) ?? [];
      if (!ids.some((id) => espSel.includes(id))) return false;
    }
    return true;
  });

  // data de amanhã DD/MM/YYYY (o que o campo inerte de Data mostra, como no antigo)
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const dataAmanha = amanha.toLocaleDateString("pt-BR");

  // resumo (h2): 1º item + "+N" no popover, como returnCityPopover/SpecialityPopover
  const nomesEspSel = espSel.map((id) => nomePorId.get(id) ?? id);
  const primeiraEsp = nomesEspSel[0] ?? "Todas especialidades";
  const primeiraCidade = cidadesSel[0] ?? "Todas cidades";
  const bold: React.CSSProperties = { fontWeight: 800 };

  return (
    <PublicShell inside>
      <header className={estilos.headerBusca}>
        <h1>Resultado das buscas</h1>
      </header>

      <main className={estilos.containerBusca}>
        <div className="container">
          <AsideBusca
            cidades={cidades}
            especialidades={especialidades.map((e) => ({ label: e.nome, value: e.id }))}
            cidadesSelecionadas={cidadesSel}
            especialidadesSelecionadas={espSel}
            tipo={tipo}
            dataAmanha={dataAmanha}
          />

          <div className="result">
            <h2 style={{ marginTop: 0, flexGrow: 1 }}>
              Resultados para{" "}
              <span style={bold}>
                {primeiraEsp}{" "}
                {nomesEspSel.length > 1 && (
                  <PopoverMais
                    rotulo={`+${nomesEspSel.length - 1} `}
                    itens={nomesEspSel.slice(1)}
                  />
                )}
              </span>
              próximos a{" "}
              <span style={bold}>
                {primeiraCidade}{" "}
                {cidadesSel.length > 1 && (
                  <PopoverMais
                    rotulo={`+${cidadesSel.length - 1}`}
                    itens={cidadesSel.slice(1)}
                  />
                )}
              </span>{" "}
              <span style={bold}>no dia {dataAmanha} </span>
              <span style={bold}>com qualquer valor</span>
            </h2>

            {clinicas.length > 0 ? (
              clinicas.map((c) => (
                <CardClinicaBusca
                  key={c.id}
                  clinica={c}
                  especialidades={(espIdsPorClinica.get(c.id) ?? [])
                    .map((id) => nomePorId.get(id))
                    .filter((n): n is string => Boolean(n))}
                />
              ))
            ) : (
              <div className={estilos.found}>
                <div className={estilos.alerta} role="alert">
                  Não foi encontrado nenhuma cliníca de acordo com os valores
                  filtrados!
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
