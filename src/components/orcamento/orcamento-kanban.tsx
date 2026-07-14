"use client";

// Porta de reference/base44 src/components/orcamento/OrcamentoKanban.jsx.
// Quadro por status (rascunho→enviado→aprovado/recusado/expirado). A mudança
// de status usa <Select> por card (moverOrcamentoStatus). O drag-and-drop
// (@hello-pangea/dnd) do Base44 é aprimoramento de interação — a mesma
// transição já é feita pelo Select; sinalizado como follow-up, não removido.
// O botão "Vender" entra no S3-2.
import { useTransition } from "react";
import { CheckCircle2, Pencil, ShoppingBag, Trash2 } from "lucide-react";

import {
  excluirOrcamento,
  moverOrcamentoStatus,
} from "@/lib/actions/orcamentos";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  formatarBRL,
  STATUS_ORCAMENTO,
  type OpcaoPaciente,
  type OpcaoProfissional,
  type OrcamentoRow,
  type StatusOrcamento,
} from "./tipos";

export function OrcamentoKanban({
  orcamentos,
  profissionais,
  pacientes,
  podeExcluir,
  podeVender,
  vendidos,
  onEditar,
  onVender,
}: {
  orcamentos: OrcamentoRow[];
  profissionais: OpcaoProfissional[];
  pacientes: OpcaoPaciente[];
  podeExcluir: boolean;
  podeVender: boolean;
  vendidos: Set<string>;
  onEditar: (o: OrcamentoRow) => void;
  onVender: (o: OrcamentoRow) => void;
}) {
  const [, startTransition] = useTransition();
  const nomeProf = new Map(profissionais.map((p) => [p.id, p.nome]));
  const nomePac = new Map(pacientes.map((p) => [p.id, p.nome]));

  function nomeCliente(o: OrcamentoRow): string {
    if (o.paciente_id) return nomePac.get(o.paciente_id) ?? o.cliente_nome ?? "Paciente";
    return o.cliente_nome ?? "Cliente avulso";
  }

  function mover(id: string, status: StatusOrcamento) {
    startTransition(async () => {
      await moverOrcamentoStatus(id, status);
    });
  }
  function excluir(id: string) {
    if (!confirm("Excluir este orçamento?")) return;
    startTransition(async () => {
      await excluirOrcamento(id);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {STATUS_ORCAMENTO.map((col) => {
        const doStatus = orcamentos.filter((o) => o.status === col.valor);
        return (
          <div key={col.valor} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="text-muted-foreground text-xs">{doStatus.length}</span>
            </div>
            <div className="flex min-h-[80px] flex-col gap-2">
              {doStatus.map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg border border-border bg-card p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{nomeCliente(o)}</p>
                      {o.profissional_id && (
                        <p className="text-muted-foreground truncate text-xs">
                          {nomeProf.get(o.profissional_id) ?? ""}
                        </p>
                      )}
                    </div>
                    <span className="whitespace-nowrap text-sm font-semibold">
                      {formatarBRL(o.valor_final || o.valor_total)}
                    </span>
                  </div>

                  <p className="text-muted-foreground mt-1 text-xs">
                    {o.itens.length} item(s) ·{" "}
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </p>

                  {vendidos.has(o.id) ? (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      <CheckCircle2 className="h-3 w-3" /> Vendido
                    </div>
                  ) : (
                    o.status === "aprovado" &&
                    podeVender && (
                      <Button
                        size="sm"
                        className="mt-2 h-7 w-full"
                        onClick={() => onVender(o)}
                      >
                        <ShoppingBag className="mr-1 h-3.5 w-3.5" /> Vender
                      </Button>
                    )
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Select
                      value={o.status}
                      onValueChange={(v) => mover(o.id, v as StatusOrcamento)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ORCAMENTO.map((s) => (
                          <SelectItem key={s.valor} value={s.valor}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditar(o)}
                        className="text-muted-foreground hover:text-foreground p-1"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {podeExcluir && (
                        <button
                          type="button"
                          onClick={() => excluir(o.id)}
                          className="text-destructive p-1 hover:opacity-70"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
