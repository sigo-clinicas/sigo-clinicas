"use client";

// Porta de reference/base44 src/pages/Orcamentos.jsx (shell: tabs Kanban /
// Vendas & Faturamento + filtros + form inline). A aba "Vendas & Faturamento"
// é preenchida no S3-2 (RPC vender_orcamento). Aqui: kanban + CRUD do orçamento.
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Terminologia } from "@/lib/terminologia";
import type { TipoClinica } from "@/lib/terminologia";

import { OrcamentoForm } from "@/components/orcamento/orcamento-form";
import { OrcamentoKanban } from "@/components/orcamento/orcamento-kanban";
import {
  STATUS_ORCAMENTO,
  type ItemTabela,
  type OpcaoConvenio,
  type OpcaoPaciente,
  type OpcaoProfissional,
  type OpcaoServico,
  type OrcamentoRow,
  type ProdutoEstoque,
  type TabelaPreco,
} from "@/components/orcamento/tipos";

export function OrcamentosClient({
  orcamentos,
  profissionais,
  convenios,
  pacientes,
  servicos,
  tabelasPreco,
  itensTabela,
  produtosEstoque,
  tipoClinica,
  termo,
  podeExcluir,
}: {
  orcamentos: OrcamentoRow[];
  profissionais: OpcaoProfissional[];
  convenios: OpcaoConvenio[];
  pacientes: OpcaoPaciente[];
  servicos: OpcaoServico[];
  tabelasPreco: TabelaPreco[];
  itensTabela: ItemTabela[];
  produtosEstoque: ProdutoEstoque[];
  tipoClinica: TipoClinica;
  termo: Terminologia;
  podeExcluir: boolean;
}) {
  const [view, setView] = useState<"lista" | "form">("lista");
  const [editando, setEditando] = useState<OrcamentoRow | null>(null);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const nomePac = useMemo(
    () => new Map(pacientes.map((p) => [p.id, p.nome])),
    [pacientes]
  );

  const filtrados = useMemo(() => {
    const termoBusca = filtroCliente.trim().toLowerCase();
    return orcamentos.filter((o) => {
      if (filtroStatus !== "todos" && o.status !== filtroStatus) return false;
      if (!termoBusca) return true;
      const nome = (
        o.paciente_id ? nomePac.get(o.paciente_id) ?? "" : o.cliente_nome ?? ""
      ).toLowerCase();
      return nome.includes(termoBusca);
    });
  }, [orcamentos, filtroCliente, filtroStatus, nomePac]);

  function novo() {
    setEditando(null);
    setView("form");
  }
  function editar(o: OrcamentoRow) {
    setEditando(o);
    setView("form");
  }
  function voltar() {
    setEditando(null);
    setView("lista");
  }

  if (view === "form") {
    return (
      <div className="p-4 md:p-6">
        <OrcamentoForm
          orcamento={editando}
          profissionais={profissionais}
          convenios={convenios}
          pacientes={pacientes}
          servicos={servicos}
          tabelasPreco={tabelasPreco}
          itensTabela={itensTabela}
          produtosEstoque={produtosEstoque}
          tipoClinica={tipoClinica}
          onSaved={voltar}
          onCancel={voltar}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{termo.orcamento}s</h1>
        <Button onClick={novo}>
          <Plus className="mr-1 h-4 w-4" /> Novo {termo.orcamento.toLowerCase()}
        </Button>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="vendas">Vendas &amp; Faturamento</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
              <Input
                className="pl-8"
                placeholder="Buscar por cliente"
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
              />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {STATUS_ORCAMENTO.map((s) => (
                  <SelectItem key={s.valor} value={s.valor}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <OrcamentoKanban
            orcamentos={filtrados}
            profissionais={profissionais}
            pacientes={pacientes}
            podeExcluir={podeExcluir}
            onEditar={editar}
          />
        </TabsContent>

        <TabsContent value="vendas">
          <div className="text-muted-foreground rounded-lg border border-dashed border-border p-8 text-center text-sm">
            As vendas aparecem aqui após aprovar um orçamento e usar o botão
            Vender. (disponível no S3-2)
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
