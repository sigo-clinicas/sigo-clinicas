"use client";

// Porta de reference/base44 src/components/orcamento/VendasFaturamento.jsx.
// Lista as vendas (orçamentos fechados) com KPIs e status das parcelas.
// A baixa/recebimento das parcelas é feita no financeiro (S3-3, RPC de baixa).
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  formatarBRL,
  type OpcaoPaciente,
  type OpcaoProfissional,
  type OrcamentoRow,
  type PagamentoRow,
  type VendaRow,
} from "./tipos";

export function VendasFaturamento({
  orcamentos,
  vendas,
  pagamentos,
  profissionais,
  pacientes,
}: {
  orcamentos: OrcamentoRow[];
  vendas: VendaRow[];
  pagamentos: PagamentoRow[];
  profissionais: OpcaoProfissional[];
  pacientes: OpcaoPaciente[];
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const orcPorId = useMemo(
    () => new Map(orcamentos.map((o) => [o.id, o])),
    [orcamentos]
  );
  const nomeProf = useMemo(
    () => new Map(profissionais.map((p) => [p.id, p.nome])),
    [profissionais]
  );
  const nomePac = useMemo(
    () => new Map(pacientes.map((p) => [p.id, p.nome])),
    [pacientes]
  );
  const pagPorVenda = useMemo(() => {
    const m = new Map<string, PagamentoRow[]>();
    for (const p of pagamentos) {
      const l = m.get(p.venda_id) ?? [];
      l.push(p);
      m.set(p.venda_id, l);
    }
    return m;
  }, [pagamentos]);

  const ativas = vendas.filter((v) => !v.cancelada);

  const kpis = useMemo(() => {
    let faturado = 0;
    let recebido = 0;
    for (const v of ativas) {
      const orc = orcPorId.get(v.orcamento_id);
      faturado += Number(orc?.valor_final ?? 0);
      for (const p of pagPorVenda.get(v.id) ?? []) {
        if (p.pago) recebido += Number(p.valor);
      }
    }
    return { faturado, recebido, pendente: faturado - recebido };
  }, [ativas, orcPorId, pagPorVenda]);

  function nomeCliente(orc: OrcamentoRow | undefined): string {
    if (!orc) return "—";
    if (orc.paciente_id) return nomePac.get(orc.paciente_id) ?? orc.cliente_nome ?? "Paciente";
    return orc.cliente_nome ?? "Cliente avulso";
  }

  if (ativas.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed border-border p-8 text-center text-sm">
        Nenhuma venda ainda. Aprove um orçamento e use o botão Vender.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Faturado", valor: kpis.faturado, cor: "" },
          { label: "Recebido", valor: kpis.recebido, cor: "text-green-600" },
          { label: "Pendente", valor: kpis.pendente, cor: "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-muted-foreground text-xs">{k.label}</p>
            <p className={`text-xl font-semibold ${k.cor}`}>{formatarBRL(k.valor)}</p>
          </div>
        ))}
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {ativas.map((v) => {
          const orc = orcPorId.get(v.orcamento_id);
          const parcelas = (pagPorVenda.get(v.id) ?? []).sort(
            (a, b) => a.numero_parcela - b.numero_parcela
          );
          const pagas = parcelas.filter((p) => p.pago).length;
          const aberto = aberta === v.id;
          return (
            <div key={v.id}>
              <button
                type="button"
                onClick={() => setAberta(aberto ? null : v.id)}
                className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 p-3 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {aberto ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{nomeCliente(orc)}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(v.data_hora).toLocaleDateString("pt-BR")}
                      {orc?.profissional_id &&
                        ` · ${nomeProf.get(orc.profissional_id) ?? ""}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {formatarBRL(Number(orc?.valor_final ?? 0))}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {pagas}/{parcelas.length} parcelas pagas
                  </p>
                </div>
              </button>

              {aberto && (
                <div className="bg-muted/30 space-y-1 px-4 pb-3 pt-1">
                  {parcelas.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        Parcela {p.numero_parcela} · venc.{" "}
                        {new Date(`${p.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}
                      </span>
                      <span
                        className={p.pago ? "text-green-600" : "text-muted-foreground"}
                      >
                        {formatarBRL(Number(p.valor))} {p.pago ? "· pago" : "· pendente"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
