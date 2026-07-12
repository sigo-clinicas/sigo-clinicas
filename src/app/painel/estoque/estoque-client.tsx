"use client";

// Porta de reference/base44 src/pages/Estoque.jsx + ItemEstoqueModal.jsx +
// EntradaEstoqueModal.jsx + SaidaEstoqueModal.jsx.
import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Search,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  History,
  BarChart3,
  X,
  Trash2,
} from "lucide-react";

import {
  excluirItem,
  registrarEntrada,
  registrarSaida,
  salvarItem,
  type ItemInput,
  type LinhaEntrada,
} from "@/lib/actions/estoque";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CLASSIFICACAO_LABEL: Record<string, string> = {
  material_consumo: "Material de Consumo",
  medicamento: "Medicamento",
  equipamento: "Equipamento",
  limpeza: "Limpeza",
  descartavel: "Descartável",
  produto_venda: "Produto para Venda",
  outros: "Outros",
};

const TIPO_MOV_LABEL: Record<string, string> = {
  saldo_inicial: "Saldo Inicial",
  entrada: "Entrada",
  saida: "Saída",
};
const TIPO_MOV_COR: Record<string, string> = {
  saldo_inicial: "text-blue-600 bg-blue-50",
  entrada: "text-green-700 bg-green-50",
  saida: "text-red-600 bg-red-50",
};

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export type ItemLinha = {
  id: string;
  codigo: string | null;
  descricao: string;
  classificacao: ItemInput["classificacao"];
  categoria: string | null;
  requer_validade: boolean;
  unidade: string | null;
  preco_custo: number | null;
  preco_venda: number | null;
  para_venda: boolean;
  estoque_minimo: number;
  fornecedor: string | null;
  ativo: boolean;
  saldo: number;
};

type Movimentacao = {
  id: string;
  item_id: string;
  tipo: "saldo_inicial" | "entrada" | "saida";
  quantidade: number;
  preco_unitario: number | null;
  valor_total: number | null;
  data: string;
  fornecedor: string | null;
  lote: string | null;
  validade: string | null;
  observacao: string | null;
};

export function EstoqueClient({
  itens,
  movimentacoes,
  centros,
  podeGerenciar,
}: {
  itens: ItemLinha[];
  movimentacoes: Movimentacao[];
  centros: { id: string; nome: string }[];
  podeGerenciar: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [aba, setAba] = useState<"itens" | "ficha" | "relatorio">("itens");
  const [itemModal, setItemModal] = useState<ItemLinha | "novo" | null>(null);
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [saidaOpen, setSaidaOpen] = useState(false);
  const [itemFicha, setItemFicha] = useState<ItemLinha | null>(null);

  const itensFiltrados = useMemo(
    () =>
      itens.filter((it) => {
        const buscaOk =
          !busca ||
          it.descricao.toLowerCase().includes(busca.toLowerCase()) ||
          it.codigo?.toLowerCase().includes(busca.toLowerCase());
        const catOk = filtro === "todos" || it.classificacao === filtro;
        return buscaOk && catOk;
      }),
    [itens, busca, filtro]
  );

  const abaixoMinimo = itens.filter(
    (it) => it.estoque_minimo > 0 && it.saldo < it.estoque_minimo
  );

  const fichaComSaldo = useMemo(() => {
    if (!itemFicha) return [];
    const movs = movimentacoes
      .filter((m) => m.item_id === itemFicha.id)
      .sort((a, b) => a.data.localeCompare(b.data));
    let saldo = 0;
    return movs.map((m) => {
      saldo += m.tipo === "saida" ? -m.quantidade : m.quantidade;
      return { ...m, saldo_acum: saldo };
    });
  }, [movimentacoes, itemFicha]);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Package className="w-5 h-5" />
            Estoque
          </h1>
          <p className="text-sm text-muted-foreground">
            {itens.length} itens cadastrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          {abaixoMinimo.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {abaixoMinimo.length} item(s) abaixo do mínimo
            </div>
          )}
          {podeGerenciar && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setSaidaOpen(true)}
              >
                <ArrowUpCircle className="w-4 h-4" /> Saída
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                onClick={() => setEntradaOpen(true)}
              >
                <ArrowDownCircle className="w-4 h-4" /> Entrada
              </Button>
              <Button onClick={() => setItemModal("novo")} size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> Novo Item
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex rounded-lg border border-border overflow-hidden text-sm w-fit">
        <button
          onClick={() => setAba("itens")}
          className={`px-4 py-2 font-medium transition-colors ${aba === "itens" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          Itens
        </button>
        <button
          onClick={() => setAba("ficha")}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-1.5 ${aba === "ficha" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <History className="w-4 h-4" /> Ficha de Controle
        </button>
        <button
          onClick={() => setAba("relatorio")}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-1.5 ${aba === "relatorio" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <BarChart3 className="w-4 h-4" /> Relatórios
        </button>
      </div>

      {aba === "itens" && (
        <>
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por descrição ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as classificações</SelectItem>
                {Object.entries(CLASSIFICACAO_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Código</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Classificação</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Custo</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo</th>
                  {podeGerenciar && (
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {itensFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      Nenhum item encontrado
                    </td>
                  </tr>
                ) : (
                  itensFiltrados.map((it) => {
                    const abaixo = it.estoque_minimo > 0 && it.saldo < it.estoque_minimo;
                    return (
                      <tr key={it.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {it.codigo || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{it.descricao}</div>
                          {it.categoria && (
                            <div className="text-xs text-muted-foreground">{it.categoria}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {CLASSIFICACAO_LABEL[it.classificacao]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {it.preco_custo != null ? fmt(it.preco_custo) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${abaixo ? "text-orange-600" : ""}`}>
                            {it.saldo} {it.unidade || "un"}
                          </span>
                          {abaixo && (
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-500 inline ml-1" />
                          )}
                        </td>
                        {podeGerenciar && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setItemFicha(it);
                                  setAba("ficha");
                                }}
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Ver ficha"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setItemModal(it)}
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-medium"
                                title="Editar"
                              >
                                ✏️
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === "ficha" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium shrink-0">Item:</Label>
            <Select
              value={itemFicha?.id || ""}
              onValueChange={(v) => setItemFicha(itens.find((x) => x.id === v) || null)}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Selecionar item..." />
              </SelectTrigger>
              <SelectContent>
                {itens.map((it) => (
                  <SelectItem key={it.id} value={it.id}>
                    {it.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!itemFicha ? (
            <div className="text-center py-16 text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Selecione um item para ver sua ficha de controle</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                {[
                  {
                    label: "Saldo Inicial",
                    value: fichaComSaldo.find((m) => m.tipo === "saldo_inicial")?.quantidade ?? 0,
                    color: "text-blue-600",
                  },
                  {
                    label: "Total Entradas",
                    value: fichaComSaldo
                      .filter((m) => m.tipo === "entrada")
                      .reduce((s, m) => s + m.quantidade, 0),
                    color: "text-green-600",
                  },
                  {
                    label: "Total Saídas",
                    value: fichaComSaldo
                      .filter((m) => m.tipo === "saida")
                      .reduce((s, m) => s + m.quantidade, 0),
                    color: "text-red-600",
                  },
                  { label: "Saldo Final", value: itemFicha.saldo, color: "text-foreground font-bold" },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-card border border-border rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                    <p className={`text-2xl font-semibold ${kpi.color}`}>
                      {kpi.value}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {itemFicha.unidade || "un"}
                      </span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Entrada</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saída</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lote/Validade</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fichaComSaldo.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-muted-foreground">
                          Nenhuma movimentação registrada
                        </td>
                      </tr>
                    ) : (
                      fichaComSaldo.map((m) => (
                        <tr key={m.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 text-muted-foreground">{formatarData(m.data)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_MOV_COR[m.tipo]}`}>
                              {TIPO_MOV_LABEL[m.tipo]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-green-700 font-medium">
                            {m.tipo !== "saida" ? `+${m.quantidade}` : ""}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600 font-medium">
                            {m.tipo === "saida" ? `-${m.quantidade}` : ""}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{m.saldo_acum}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {m.lote ? `Lote ${m.lote}` : ""}
                            {m.validade ? ` · val ${formatarData(m.validade)}` : ""}
                            {!m.lote && !m.validade ? "—" : ""}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {m.observacao || m.fornecedor || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {aba === "relatorio" && (
        <RelatorioEstoque itens={itens} abaixoMinimo={abaixoMinimo} />
      )}

      {itemModal && (
        <ItemModal
          item={itemModal === "novo" ? null : itemModal}
          onClose={() => setItemModal(null)}
        />
      )}
      {entradaOpen && (
        <EntradaModal
          itens={itens}
          centros={centros}
          onClose={() => setEntradaOpen(false)}
        />
      )}
      {saidaOpen && (
        <SaidaModal itens={itens} onClose={() => setSaidaOpen(false)} />
      )}
    </div>
  );
}

function RelatorioEstoque({
  itens,
  abaixoMinimo,
}: {
  itens: ItemLinha[];
  abaixoMinimo: ItemLinha[];
}) {
  const valorTotal = itens.reduce(
    (s, it) => s + (it.preco_custo ?? 0) * it.saldo,
    0
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Itens cadastrados</p>
          <p className="text-2xl font-semibold">{itens.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Valor em estoque (custo)</p>
          <p className="text-2xl font-semibold">{fmt(valorTotal)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Abaixo do mínimo</p>
          <p className="text-2xl font-semibold text-orange-600">{abaixoMinimo.length}</p>
        </div>
      </div>
      {abaixoMinimo.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-orange-50 px-4 py-2.5 border-b border-border text-sm font-medium text-orange-800">
            Itens abaixo do estoque mínimo
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {abaixoMinimo.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2.5 font-medium">{it.descricao}</td>
                  <td className="px-4 py-2.5 text-right text-orange-600">
                    {it.saldo} / mín {it.estoque_minimo} {it.unidade || "un"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ItemModal({
  item,
  onClose,
}: {
  item: ItemLinha | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ItemInput>({
    id: item?.id,
    codigo: item?.codigo ?? "",
    descricao: item?.descricao ?? "",
    classificacao: item?.classificacao ?? "material_consumo",
    categoria: item?.categoria ?? "",
    requer_validade: item?.requer_validade ?? false,
    unidade: item?.unidade ?? "un",
    preco_custo: item?.preco_custo ?? null,
    preco_venda: item?.preco_venda ?? null,
    para_venda: item?.para_venda ?? false,
    estoque_minimo: item?.estoque_minimo ?? 0,
    fornecedor: item?.fornecedor ?? "",
    ativo: item?.ativo ?? true,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function set<K extends keyof ItemInput>(k: K, v: ItemInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">
            {item ? "Editar Item" : "Novo Item de Estoque"}
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input value={form.codigo ?? ""} onChange={(e) => set("codigo", e.target.value)} placeholder="Ex: MAT001" />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Input value={form.unidade ?? ""} onChange={(e) => set("unidade", e.target.value)} placeholder="un, cx, ml..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Input value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Nome do produto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Classificação</Label>
              <Select
                value={form.classificacao}
                onValueChange={(v) => set("classificacao", v as ItemInput["classificacao"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLASSIFICACAO_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria (livre)</Label>
              <Input value={form.categoria ?? ""} onChange={(e) => set("categoria", e.target.value)} placeholder="Ex: Botox, Fios..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço de Custo (R$)</Label>
              <Input
                type="number"
                value={form.preco_custo ?? ""}
                onChange={(e) => set("preco_custo", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Preço de Venda (R$)</Label>
              <Input
                type="number"
                value={form.preco_venda ?? ""}
                onChange={(e) => set("preco_venda", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Estoque Mínimo</Label>
            <Input
              type="number"
              value={form.estoque_minimo || ""}
              onChange={(e) => set("estoque_minimo", Number(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
            <input type="checkbox" checked={form.para_venda} onChange={(e) => set("para_venda", e.target.checked)} className="rounded" />
            <div>
              <span className="font-medium text-emerald-800">Produto para venda</span>
              <p className="text-xs text-muted-foreground">Disponibiliza para venda direta na agenda (funil no Sprint 3)</p>
            </div>
          </label>
          <div className="space-y-1.5">
            <Label>Fornecedor</Label>
            <Input value={form.fornecedor ?? ""} onChange={(e) => set("fornecedor", e.target.value)} placeholder="Nome do fornecedor" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer p-3 border border-orange-200 bg-orange-50 rounded-lg">
            <input type="checkbox" checked={form.requer_validade} onChange={(e) => set("requer_validade", e.target.checked)} className="rounded" />
            <div>
              <span className="font-medium">Produto com validade</span>
              <p className="text-xs text-muted-foreground">Torna a data de validade obrigatória na entrada</p>
            </div>
          </label>
        </div>
        {erro && <p className="px-5 pb-2 text-sm text-destructive">{erro}</p>}
        <div className="flex items-center gap-2 p-5 border-t border-border">
          {item && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!confirm("Excluir este item do estoque?")) return;
                startTransition(async () => {
                  const r = await excluirItem(item.id);
                  if (r.erro) setErro(r.erro);
                  else onClose();
                });
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={salvando || !form.descricao}
            onClick={() =>
              startTransition(async () => {
                const r = await salvarItem(form);
                if (r.erro) setErro(r.erro);
                else onClose();
              })
            }
          >
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntradaModal({
  itens,
  centros,
  onClose,
}: {
  itens: ItemLinha[];
  centros: { id: string; nome: string }[];
  onClose: () => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [fornecedor, setFornecedor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [centroId, setCentroId] = useState("");
  const [linhas, setLinhas] = useState<LinhaEntrada[]>([
    { item_id: "", quantidade: 0, preco_unitario: null, lote: "", validade: "" },
  ]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const validas = linhas.filter((l) => l.item_id && Number(l.quantidade) > 0);
  const total = linhas.reduce(
    (s, l) => s + Number(l.quantidade || 0) * Number(l.preco_unitario || 0),
    0
  );

  function updateLinha(idx: number, patch: Partial<LinhaEntrada>) {
    setLinhas((ls) =>
      ls.map((row, i) => {
        if (i !== idx) return row;
        const upd = { ...row, ...patch };
        if (patch.item_id) {
          const item = itens.find((x) => x.id === patch.item_id);
          if (item?.preco_custo != null) upd.preco_unitario = item.preco_custo;
        }
        return upd;
      })
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Registrar Entrada de Estoque</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Centro de Custo</Label>
            <Select value={centroId || "sem"} onValueChange={(v) => setCentroId(v === "sem" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sem centro definido" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem">Sem centro definido</SelectItem>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Itens da Entrada</Label>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-7 text-xs"
                onClick={() =>
                  setLinhas((ls) => [...ls, { item_id: "", quantidade: 0, preco_unitario: null, lote: "", validade: "" }])
                }
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Item
              </Button>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-20">Qtd</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-24">Preço</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-24">Lote</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-28">Validade</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {linhas.map((linha, idx) => {
                    const item = itens.find((x) => x.id === linha.item_id);
                    const requer = item?.requer_validade;
                    return (
                      <tr key={idx} className="bg-card">
                        <td className="px-3 py-2">
                          <Select value={linha.item_id} onValueChange={(v) => updateLinha(idx, { item_id: v })}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecionar item..." />
                            </SelectTrigger>
                            <SelectContent>
                              {itens.map((it) => (
                                <SelectItem key={it.id} value={it.id}>
                                  {it.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            className="h-8 text-xs text-right"
                            value={linha.quantidade || ""}
                            onChange={(e) => updateLinha(idx, { quantidade: Number(e.target.value) })}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            className="h-8 text-xs text-right"
                            value={linha.preco_unitario ?? ""}
                            onChange={(e) =>
                              updateLinha(idx, { preco_unitario: e.target.value === "" ? null : Number(e.target.value) })
                            }
                            placeholder="0,00"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            className="h-8 text-xs"
                            value={linha.lote ?? ""}
                            onChange={(e) => updateLinha(idx, { lote: e.target.value })}
                            placeholder="Nº lote"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="date"
                            className={`h-8 text-xs ${requer && !linha.validade ? "border-red-400 bg-red-50" : ""}`}
                            value={linha.validade ?? ""}
                            onChange={(e) => updateLinha(idx, { validade: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {linhas.length > 1 && (
                            <button
                              onClick={() => setLinhas((ls) => ls.filter((_, i) => i !== idx))}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Nº NF, referência, etc." />
          </div>

          <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border border-border rounded-lg">
            <div>
              <p className="text-sm font-medium">Total da Entrada</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lançamento em contas a pagar será gerado no Financeiro (Sprint 3)
              </p>
            </div>
            <p className="text-xl font-bold">{fmt(total)}</p>
          </div>
        </div>

        {erro && <p className="px-5 pb-2 text-sm text-destructive">{erro}</p>}
        <div className="flex items-center gap-2 p-5 border-t border-border shrink-0">
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={salvando || validas.length === 0}
            onClick={() =>
              startTransition(async () => {
                const r = await registrarEntrada({
                  data,
                  fornecedor,
                  observacao,
                  centro_custo_id: centroId || null,
                  linhas: validas,
                });
                if (r.erro) setErro(r.erro);
                else onClose();
              })
            }
          >
            {salvando ? "Salvando..." : `Registrar Entrada (${validas.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SaidaModal({
  itens,
  onClose,
}: {
  itens: ItemLinha[];
  onClose: () => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [observacao, setObservacao] = useState("");
  const [linhas, setLinhas] = useState<{ item_id: string; quantidade: number }[]>([
    { item_id: "", quantidade: 0 },
  ]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const validas = linhas.filter((l) => l.item_id && Number(l.quantidade) > 0);
  // Pré-aviso client-side; o bloqueio REAL é atômico na RPC (contra corrida).
  const avisos = linhas.map((l) => {
    if (!l.item_id || !l.quantidade) return null;
    const item = itens.find((x) => x.id === l.item_id);
    if (item && Number(l.quantidade) > item.saldo)
      return `Saldo insuficiente (disponível: ${item.saldo})`;
    return null;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Registrar Saída de Estoque</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Data *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-40" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Itens da Saída</Label>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-7 text-xs"
                onClick={() => setLinhas((ls) => [...ls, { item_id: "", quantidade: 0 }])}
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Item
              </Button>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-28">Quantidade</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {linhas.map((linha, idx) => {
                    const item = itens.find((x) => x.id === linha.item_id);
                    return (
                      <tr key={idx} className="bg-card">
                        <td className="px-3 py-2">
                          <Select value={linha.item_id} onValueChange={(v) => setLinhas((ls) => ls.map((r, i) => (i === idx ? { ...r, item_id: v } : r)))}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecionar item..." />
                            </SelectTrigger>
                            <SelectContent>
                              {itens.map((it) => (
                                <SelectItem key={it.id} value={it.id}>
                                  {it.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {item && (
                            <div className="text-xs mt-0.5 pl-1">
                              <span className="text-muted-foreground">Saldo: </span>
                              <span className={item.saldo <= 0 ? "text-destructive font-medium" : "text-foreground"}>
                                {item.saldo} {item.unidade || "un"}
                              </span>
                            </div>
                          )}
                          {avisos[idx] && <p className="text-xs text-destructive mt-0.5 pl-1">{avisos[idx]}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            className="h-8 text-xs text-right"
                            value={linha.quantidade || ""}
                            onChange={(e) => setLinhas((ls) => ls.map((r, i) => (i === idx ? { ...r, quantidade: Number(e.target.value) } : r)))}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {linhas.length > 1 && (
                            <button
                              onClick={() => setLinhas((ls) => ls.filter((_, i) => i !== idx))}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observação / Motivo</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: uso em procedimento, descarte, etc." />
          </div>
        </div>

        {erro && <p className="px-5 pb-2 text-sm text-destructive">{erro}</p>}
        <div className="flex items-center gap-2 p-5 border-t border-border shrink-0">
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={salvando || validas.length === 0}
            onClick={() =>
              startTransition(async () => {
                const r = await registrarSaida({ data, observacao, linhas: validas });
                if (r.erro) setErro(r.erro);
                else onClose();
              })
            }
          >
            {salvando ? "Salvando..." : `Registrar Saída (${validas.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
