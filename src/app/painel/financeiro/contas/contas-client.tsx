"use client";

// Porta de reference/base44 Contas.jsx — hub com 3 abas: contas bancárias
// (saldo da view), categorias (hierárquicas) e centros de custo.
import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { excluirConta } from "@/lib/actions/financeiro";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriasLista } from "@/components/financeiro/categorias-lista";
import { CentroCustoPanel } from "@/components/financeiro/centro-custo-panel";
import { ContaBancariaModal } from "@/components/financeiro/conta-bancaria-modal";
import {
  formatarBRL,
  TIPO_CONTA_LABEL,
  type CategoriaRow,
  type CentroCustoRow,
  type ContaRow,
} from "@/components/financeiro/tipos";

export function ContasClient({
  contas,
  categorias,
  centros,
}: {
  contas: ContaRow[];
  categorias: CategoriaRow[];
  centros: CentroCustoRow[];
}) {
  const [modalConta, setModalConta] = useState(false);
  const [editando, setEditando] = useState<ContaRow | null>(null);
  const [, startTransition] = useTransition();

  function excluir(id: string) {
    if (!confirm("Excluir conta bancária?")) return;
    startTransition(async () => {
      await excluirConta(id);
    });
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Contas</h1>

      <Tabs defaultValue="contas">
        <TabsList>
          <TabsTrigger value="contas">Contas bancárias</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="centros">Centros de custo</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditando(null);
                setModalConta(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Nova conta
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contas.length === 0 && (
              <p className="text-muted-foreground text-sm">Nenhuma conta cadastrada.</p>
            )}
            {contas.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{c.nome}</p>
                    <p className="text-muted-foreground text-xs">
                      {TIPO_CONTA_LABEL[c.tipo]}
                      {!c.ativo && " · inativa"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(c);
                        setModalConta(true);
                      }}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => excluir(c.id)}
                      className="text-destructive p-1 hover:opacity-70"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {(c.banco || c.numero_conta) && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {c.banco}
                    {c.agencia && ` · Ag ${c.agencia}`}
                    {c.numero_conta && ` · Cc ${c.numero_conta}`}
                  </p>
                )}
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs">Saldo atual</p>
                    <p className="text-lg font-semibold">{formatarBRL(c.saldo_atual)}</p>
                  </div>
                  <Link
                    href={`/painel/financeiro/contas/${c.id}`}
                    className="text-primary text-xs hover:underline"
                  >
                    Extrato →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categorias">
          <div className="grid gap-6 md:grid-cols-2">
            <CategoriasLista tipo="receita" categorias={categorias} />
            <CategoriasLista tipo="despesa" categorias={categorias} />
          </div>
        </TabsContent>

        <TabsContent value="centros">
          <CentroCustoPanel centros={centros} />
        </TabsContent>
      </Tabs>

      {modalConta && (
        <ContaBancariaModal open={modalConta} onOpenChange={setModalConta} conta={editando} />
      )}
    </div>
  );
}
