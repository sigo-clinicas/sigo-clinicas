"use client";

// Porta de reference/base44 Relatorios.jsx — KPIs CONFIGURÁVEIS (ordem em
// config.dashboard) + gráficos self-contained (sem recharts). Filtro de período
// via form GET (SSR). Financeiro por regime de caixa (reconcilia com o S3).
import { useState, useTransition } from "react";
import { Settings2 } from "lucide-react";

import { atualizarConfigDashboard } from "@/lib/actions/relatorios";
import {
  formatarKpi,
  KPIS,
  type KpiId,
  type ResumoDashboard,
} from "@/lib/relatorios/kpis";
import { Button } from "@/components/ui/button";

const TODOS_KPIS = Object.keys(KPIS) as KpiId[];

export function RelatoriosClient({
  resumo,
  kpisConfig,
  ini,
  fim,
  podeConfigurar,
  nomeProf,
  nomeServico,
}: {
  resumo: ResumoDashboard | null;
  kpisConfig: KpiId[];
  ini: string;
  fim: string;
  podeConfigurar: boolean;
  nomeProf: Record<string, string>;
  nomeServico: Record<string, string>;
}) {
  const [config, setConfig] = useState(false);
  const [selecao, setSelecao] = useState<KpiId[]>(kpisConfig);
  const [, startTransition] = useTransition();

  if (!resumo) {
    return <div className="p-6 text-muted-foreground">Sem dados no período.</div>;
  }

  function toggleKpi(id: KpiId) {
    setSelecao((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function salvarConfig() {
    startTransition(async () => {
      await atualizarConfigDashboard(selecao);
      setConfig(false);
    });
  }

  const maxProf = Math.max(1, ...resumo.por_profissional.map((p) => p.qtd));
  const maxServ = Math.max(1, ...resumo.servicos_mais_vendidos.map((s) => s.qtd));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Relatórios</h1>
        <div className="flex items-center gap-3">
          <form method="get" className="flex items-end gap-2">
            <label className="text-xs">
              <span className="text-muted-foreground block">De</span>
              <input type="date" name="ini" defaultValue={ini} className="border-border bg-background h-9 rounded-md border px-2 text-sm" />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground block">Até</span>
              <input type="date" name="fim" defaultValue={fim} className="border-border bg-background h-9 rounded-md border px-2 text-sm" />
            </label>
            <Button type="submit" size="sm" variant="outline">Aplicar</Button>
          </form>
          {podeConfigurar && (
            <Button size="sm" variant="outline" onClick={() => setConfig((c) => !c)}>
              <Settings2 className="mr-1 h-4 w-4" /> Personalizar
            </Button>
          )}
        </div>
      </div>

      {config && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium">KPIs exibidos (a ordem de seleção é a ordem de exibição)</p>
          <div className="flex flex-wrap gap-2">
            {TODOS_KPIS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleKpi(id)}
                className={`rounded-full border px-3 py-1 text-sm ${selecao.includes(id) ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {KPIS[id].label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={salvarConfig}>Salvar painel</Button>
        </div>
      )}

      {/* KPIs configurados */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpisConfig.map((id) => {
          const def = KPIS[id];
          return (
            <div key={id} className="rounded-lg border border-border bg-card p-3">
              <p className="text-muted-foreground text-xs">{def.label}</p>
              <p className="text-lg font-semibold">{formatarKpi(def.valor(resumo), def.formato)}</p>
            </div>
          );
        })}
      </div>

      {/* Gráficos self-contained */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Agendamentos por profissional</h2>
          {resumo.por_profissional.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {resumo.por_profissional.map((p) => (
                <div key={p.profissional_id ?? "s"} className="flex items-center gap-2">
                  <span className="w-32 truncate text-xs">{nomeProf[p.profissional_id] ?? "—"}</span>
                  <div className="bg-muted h-4 flex-1 overflow-hidden rounded">
                    <div className="bg-primary h-full" style={{ width: `${(p.qtd / maxProf) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs">{p.qtd}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Serviços mais realizados</h2>
          {resumo.servicos_mais_vendidos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {resumo.servicos_mais_vendidos.map((s) => (
                <div key={s.servico_id} className="flex items-center gap-2">
                  <span className="w-32 truncate text-xs">{nomeServico[s.servico_id] ?? "—"}</span>
                  <div className="bg-muted h-4 flex-1 overflow-hidden rounded">
                    <div className="bg-green-500 h-full" style={{ width: `${(s.qtd / maxServ) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs">{s.qtd}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
