"use client";

// Porta de reference/base44 src/pages/Servicos.jsx + ServicoModal.jsx +
// TabelaPrecoModal.jsx. Sidebar "Marketing" do original portada fiel
// (itens desabilitados como no protótipo).
import { useState, useTransition } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  DollarSign,
  List,
  ChevronDown,
  ChevronRight,
  Zap,
  X,
  Check,
  Globe,
} from "lucide-react";

import {
  excluirServico,
  excluirTabelaPreco,
  salvarServico,
  salvarTabelaPreco,
  type ItemTabelaInput,
  type ServicoInput,
  type TabelaPrecoInput,
} from "@/lib/actions/servicos";
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

type Opcao = { id: string; nome: string };

type ServicoLinha = {
  id: string;
  nome: string;
  codigo: string | null;
  duracao_minutos: number;
  especialidade_id: string | null;
  exibir_publico: boolean;
  observacoes: string | null;
  ativo: boolean;
};

type ItemLinha = {
  id: string;
  servico_id: string;
  tipo_valor: "fixo" | "a_partir_de" | "gratuito";
  valor: number | null;
};

type TabelaLinha = {
  id: string;
  nome: string;
  convenio_id: string | null;
  convenio_nome: string | null;
  descricao: string | null;
  exibir_publico: boolean;
  ativo: boolean;
  itens: ItemLinha[];
};

function FormatValor({ item }: { item: { tipo_valor: string; valor: number | null } }) {
  if (item.tipo_valor === "gratuito")
    return <span className="text-green-600 font-medium">Gratuito</span>;
  const v = `R$ ${Number(item.valor ?? 0).toFixed(2).replace(".", ",")}`;
  if (item.tipo_valor === "a_partir_de")
    return (
      <span className="text-muted-foreground">
        A partir de <span className="text-foreground font-medium">{v}</span>
      </span>
    );
  return <span className="font-medium">{v}</span>;
}

function TabelaCard({
  tabela,
  servicos,
  podeGerenciar,
  onEdit,
}: {
  tabela: TabelaLinha;
  servicos: ServicoLinha[];
  podeGerenciar: boolean;
  onEdit: (t: TabelaLinha) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <div>
            <h3 className="font-semibold text-sm">{tabela.nome}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tabela.convenio_nome || "Particular"} · {tabela.itens.length}{" "}
              serviço(s)
              {tabela.descricao && ` · ${tabela.descricao}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tabela.exibir_publico && (
            <span className="text-xs text-primary flex items-center gap-1">
              <Globe className="w-3 h-3" /> Pública
            </span>
          )}
          {!tabela.ativo && (
            <span className="text-xs text-red-500 font-medium">● Inativo</span>
          )}
          {podeGerenciar && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(tabela);
              }}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {open &&
        (tabela.itens.length === 0 ? (
          <div className="px-5 pb-4 text-sm text-muted-foreground italic">
            Nenhum serviço nesta tabela.
          </div>
        ) : (
          <table className="w-full text-sm border-t border-border">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">
                  Serviço
                </th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {tabela.itens.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-5 py-2.5">
                    {servicos.find((s) => s.id === item.servico_id)?.nome ?? "—"}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <FormatValor item={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </div>
  );
}

export function ServicosClient({
  servicos,
  tabelas,
  convenios,
  especialidades,
  podeGerenciar,
}: {
  servicos: ServicoLinha[];
  tabelas: TabelaLinha[];
  convenios: Opcao[];
  especialidades: Opcao[];
  podeGerenciar: boolean;
}) {
  const [tab, setTab] = useState<"servicos" | "tabela">("servicos");
  const [expandMarketing, setExpandMarketing] = useState(true);
  const [servicoModal, setServicoModal] = useState(false);
  const [servicoSel, setServicoSel] = useState<ServicoLinha | null>(null);
  const [tabelaModal, setTabelaModal] = useState(false);
  const [tabelaSel, setTabelaSel] = useState<TabelaLinha | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="flex gap-6">
      <div className="w-48 pt-6">
        <div className="space-y-1">
          <button
            onClick={() => setExpandMarketing(!expandMarketing)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm font-medium"
          >
            {expandMarketing ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Zap className="w-4 h-4" />
            Marketing
          </button>
          {expandMarketing && (
            <div className="pl-6 space-y-1">
              <button className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground font-medium">
                Portal Público
              </button>
              <button
                disabled
                className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-muted-foreground opacity-50 cursor-not-allowed"
              >
                Comunicação (fazer depois)
              </button>
              <button
                disabled
                className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-muted-foreground opacity-50 cursor-not-allowed"
              >
                Campanhas (fazer depois)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Serviços e Tabelas de Preços
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie serviços e tabelas de repasse por convênio
            </p>
          </div>
          {podeGerenciar && (
            <Button
              onClick={() => {
                if (tab === "servicos") {
                  setServicoSel(null);
                  setServicoModal(true);
                } else {
                  setTabelaSel(null);
                  setTabelaModal(true);
                }
              }}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {tab === "servicos" ? "Novo Serviço" : "Nova Tabela"}
            </Button>
          )}
        </div>

        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab("servicos")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === "servicos"
                ? "bg-card shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <List className="w-3.5 h-3.5" /> Serviços
            </span>
          </button>
          <button
            onClick={() => setTab("tabela")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === "tabela"
                ? "bg-card shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Tabelas de Preços
            </span>
          </button>
        </div>

        {tab === "servicos" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servicos.length === 0 ? (
              <div className="col-span-3 text-center py-16 text-muted-foreground">
                <List className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum serviço cadastrado.</p>
              </div>
            ) : (
              servicos.map((s) => (
                <div key={s.id} className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-sm">{s.nome}</h3>
                      {s.codigo && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cód: {s.codigo}
                        </p>
                      )}
                    </div>
                    {podeGerenciar && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setServicoSel(s);
                            setServicoModal(true);
                          }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (!confirm("Excluir este serviço?")) return;
                            startTransition(async () => {
                              await excluirServico(s.id);
                            });
                          }}
                          className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" /> {s.duracao_minutos} min
                    </span>
                    {s.especialidade_id && (
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        {especialidades.find((e) => e.id === s.especialidade_id)?.nome}
                      </span>
                    )}
                    {s.exibir_publico && (
                      <span className="text-xs text-primary flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Público
                      </span>
                    )}
                    {!s.ativo && (
                      <span className="text-xs text-red-500 font-medium">● Inativo</span>
                    )}
                  </div>
                  {s.observacoes && (
                    <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">
                      {s.observacoes}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {tabelas.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma tabela cadastrada.</p>
              </div>
            ) : (
              tabelas.map((t) => (
                <TabelaCard
                  key={t.id}
                  tabela={t}
                  servicos={servicos}
                  podeGerenciar={podeGerenciar}
                  onEdit={(tb) => {
                    setTabelaSel(tb);
                    setTabelaModal(true);
                  }}
                />
              ))
            )}
          </div>
        )}

        {servicoModal && (
          <ServicoModal
            servico={servicoSel}
            especialidades={especialidades}
            onClose={() => setServicoModal(false)}
          />
        )}
        {tabelaModal && (
          <TabelaPrecoModal
            tabela={tabelaSel}
            servicos={servicos}
            convenios={convenios}
            onClose={() => setTabelaModal(false)}
          />
        )}
      </div>
    </div>
  );
}

function ServicoModal({
  servico,
  especialidades,
  onClose,
}: {
  servico: ServicoLinha | null;
  especialidades: Opcao[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<ServicoInput>({
    id: servico?.id,
    nome: servico?.nome ?? "",
    codigo: servico?.codigo ?? "",
    duracao_minutos: servico?.duracao_minutos ?? 30,
    especialidade_id: servico?.especialidade_id ?? null,
    exibir_publico: servico?.exibir_publico ?? false,
    observacoes: servico?.observacoes ?? "",
    ativo: servico?.ativo ?? true,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function set<K extends keyof ServicoInput>(k: K, v: ServicoInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">
            {servico ? "Editar Serviço" : "Novo Serviço"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <Label>Nome do Serviço *</Label>
            <Input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex: Consulta Inicial"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input
                value={form.codigo ?? ""}
                onChange={(e) => set("codigo", e.target.value)}
                placeholder="Ex: 10101012"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duração Padrão (min)</Label>
              <Input
                type="number"
                value={form.duracao_minutos}
                onChange={(e) => set("duracao_minutos", Number(e.target.value))}
                min={5}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Especialidade</Label>
            <Select
              value={form.especialidade_id ?? "nenhuma"}
              onValueChange={(v) =>
                set("especialidade_id", v === "nenhuma" ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                {especialidades.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Input
              value={form.observacoes ?? ""}
              onChange={(e) => set("observacoes", e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer p-3 border border-border bg-muted/20 rounded-lg">
            <input
              type="checkbox"
              checked={form.exibir_publico}
              onChange={(e) => set("exibir_publico", e.target.checked)}
              className="rounded"
            />
            <div>
              <span className="font-medium">Exibir na página pública</span>
              <p className="text-xs text-muted-foreground">
                O serviço aparece no marketplace e pode ser agendado online
              </p>
            </div>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => set("ativo", e.target.checked)}
              className="rounded"
            />
            Ativo
          </label>
        </div>
        {erro && <p className="px-5 pb-2 text-sm text-destructive">{erro}</p>}
        <div className="flex items-center gap-2 p-5 border-t border-border">
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={salvando}
            onClick={() =>
              startTransition(async () => {
                const r = await salvarServico(form);
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

function TabelaPrecoModal({
  tabela,
  servicos,
  convenios,
  onClose,
}: {
  tabela: TabelaLinha | null;
  servicos: ServicoLinha[];
  convenios: Opcao[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<TabelaPrecoInput>({
    id: tabela?.id,
    nome: tabela?.nome ?? "",
    convenio_id: tabela?.convenio_id ?? null,
    descricao: tabela?.descricao ?? "",
    exibir_publico: tabela?.exibir_publico ?? false,
    ativo: tabela?.ativo ?? true,
    itens:
      tabela?.itens.map((i) => ({
        servico_id: i.servico_id,
        tipo_valor: i.tipo_valor,
        valor: i.valor,
      })) ?? [],
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function setF<K extends keyof TabelaPrecoInput>(k: K, v: TabelaPrecoInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function updateItem(idx: number, patch: Partial<ItemTabelaInput>) {
    setF(
      "itens",
      form.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">
            {tabela ? "Editar Tabela" : "Nova Tabela de Preços"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome da Tabela *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setF("nome", e.target.value)}
                  placeholder="Ex: Tabela Particular 2026"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Convênio (vazio = Particular)</Label>
                <Select
                  value={form.convenio_id ?? "particular"}
                  onValueChange={(v) =>
                    setF("convenio_id", v === "particular" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Particular" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="particular">Particular</SelectItem>
                    {convenios.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                value={form.descricao ?? ""}
                onChange={(e) => setF("descricao", e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.exibir_publico}
                onChange={(e) => setF("exibir_publico", e.target.checked)}
                className="rounded"
              />
              Exibir preços na página pública
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setF("ativo", e.target.checked)}
                className="rounded"
              />
              Tabela ativa
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Serviços desta tabela</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setF("itens", [
                    ...form.itens,
                    { servico_id: "", tipo_valor: "fixo", valor: null },
                  ])
                }
                className="gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Serviço
              </Button>
            </div>

            {form.itens.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                Nenhum serviço adicionado. Clique em &quot;Adicionar Serviço&quot;.
              </div>
            ) : (
              <div className="space-y-2">
                {form.itens.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/40 rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <Select
                        value={item.servico_id || "none"}
                        onValueChange={(v) =>
                          updateItem(idx, { servico_id: v === "none" ? "" : v })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecionar serviço" />
                        </SelectTrigger>
                        <SelectContent>
                          {servicos.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Select
                      value={item.tipo_valor}
                      onValueChange={(v) =>
                        updateItem(idx, {
                          tipo_valor: v as ItemTabelaInput["tipo_valor"],
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixo">Valor fixo</SelectItem>
                        <SelectItem value="a_partir_de">A partir de</SelectItem>
                        <SelectItem value="gratuito">Gratuito</SelectItem>
                      </SelectContent>
                    </Select>
                    {item.tipo_valor !== "gratuito" ? (
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          value={item.valor ?? ""}
                          onChange={(e) =>
                            updateItem(idx, { valor: Number(e.target.value) })
                          }
                          className="h-8 text-xs pl-8"
                          placeholder="0,00"
                          min={0}
                          step={0.01}
                        />
                      </div>
                    ) : (
                      <div className="w-28 h-8 flex items-center justify-center">
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Gratuito
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() =>
                        setF(
                          "itens",
                          form.itens.filter((_, i) => i !== idx)
                        )
                      }
                      className="p-1.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {erro && <p className="px-5 pb-2 text-sm text-destructive">{erro}</p>}

        <div className="flex items-center gap-2 p-5 border-t border-border">
          {tabela && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!confirm("Excluir esta tabela e todos os seus itens?")) return;
                startTransition(async () => {
                  const r = await excluirTabelaPreco(tabela.id);
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
            disabled={salvando}
            onClick={() =>
              startTransition(async () => {
                const r = await salvarTabelaPreco(form);
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
