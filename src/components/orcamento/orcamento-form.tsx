"use client";

// Porta de reference/base44 src/pages/Orcamentos.jsx (OrcamentoForm inline).
// Formulário de criação/edição — itens (serviço/produto), regiões, desconto
// (percentual|valor) e totais espelhando a RPC salvar_orcamento (servidor).
import { useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";

import {
  salvarOrcamento,
  type OrcamentoInput,
} from "@/lib/actions/orcamentos";
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
import type { TipoClinica } from "@/lib/terminologia";

import { ItemOrcamentoModal } from "./item-orcamento-modal";
import { ItemEstoqueOrcamentoModal } from "./item-estoque-orcamento-modal";
import {
  calcularTotais,
  formatarBRL,
  STATUS_ORCAMENTO,
  TIPO_VALOR_LABEL,
  type ItemFormulario,
  type ItemTabela,
  type OpcaoConvenio,
  type OpcaoPaciente,
  type OpcaoProfissional,
  type OpcaoServico,
  type OrcamentoRow,
  type ProdutoEstoque,
  type StatusOrcamento,
  type TabelaPreco,
} from "./tipos";

const AVULSO = "__avulso__";
const NENHUM = "__nenhum__";

export function OrcamentoForm({
  orcamento,
  profissionais,
  convenios,
  pacientes,
  servicos,
  tabelasPreco,
  itensTabela,
  produtosEstoque,
  tipoClinica,
  onSaved,
  onCancel,
}: {
  orcamento: OrcamentoRow | null;
  profissionais: OpcaoProfissional[];
  convenios: OpcaoConvenio[];
  pacientes: OpcaoPaciente[];
  servicos: OpcaoServico[];
  tabelasPreco: TabelaPreco[];
  itensTabela: ItemTabela[];
  produtosEstoque: ProdutoEstoque[];
  tipoClinica: TipoClinica;
  onSaved: () => void;
  onCancel: () => void;
}) {
  function itensIniciais(): ItemFormulario[] {
    if (!orcamento) return [];
    return orcamento.itens.map((it) => {
      const nome = it.servico_id
        ? servicos.find((s) => s.id === it.servico_id)?.nome ?? "Serviço"
        : produtosEstoque.find((p) => p.id === it.item_estoque_id)?.descricao ?? "Produto";
      return {
        servico_id: it.servico_id,
        item_estoque_id: it.item_estoque_id,
        nome,
        quantidade: Number(it.quantidade),
        valor_unitario: Number(it.valor_unitario),
        tipo_valor: it.tipo_valor,
        regioes: it.regioes ?? [],
        unidade: it.unidade,
        observacao: it.observacao,
      };
    });
  }

  const [pacienteId, setPacienteId] = useState<string>(orcamento?.paciente_id ?? "");
  const [avulso, setAvulso] = useState(!!orcamento && !orcamento.paciente_id);
  const [clienteNome, setClienteNome] = useState(orcamento?.cliente_nome ?? "");
  const [clienteTelefone, setClienteTelefone] = useState(orcamento?.cliente_telefone ?? "");
  const [clienteEmail, setClienteEmail] = useState(orcamento?.cliente_email ?? "");
  const [profissionalId, setProfissionalId] = useState(orcamento?.profissional_id ?? "");
  const [convenioId, setConvenioId] = useState(orcamento?.convenio_id ?? "");
  const [status, setStatus] = useState<StatusOrcamento>(orcamento?.status ?? "rascunho");
  const [validadeDias, setValidadeDias] = useState(orcamento?.validade_dias ?? 30);
  const [tipoDesconto, setTipoDesconto] = useState<"percentual" | "valor">(
    orcamento?.tipo_desconto ?? "percentual"
  );
  const [desconto, setDesconto] = useState(orcamento?.desconto ?? 0);
  const [observacoes, setObservacoes] = useState(orcamento?.observacoes ?? "");
  const [anotacoes, setAnotacoes] = useState(orcamento?.anotacoes_internas ?? "");
  const [itens, setItens] = useState<ItemFormulario[]>(itensIniciais);

  const [modalServico, setModalServico] = useState(false);
  const [modalProduto, setModalProduto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const { valorTotal, descontoAplicado, valorFinal } = calcularTotais(
    itens,
    tipoDesconto,
    desconto
  );

  function escolherPaciente(v: string) {
    if (v === AVULSO) {
      setAvulso(true);
      setPacienteId("");
      return;
    }
    setAvulso(false);
    setPacienteId(v);
    const p = pacientes.find((x) => x.id === v);
    if (p) {
      setClienteNome(p.nome);
      setClienteTelefone(p.telefone ?? "");
      setClienteEmail(p.email ?? "");
      if (p.convenio_id) setConvenioId(p.convenio_id);
    }
  }

  function adicionarItem(item: ItemFormulario) {
    setItens((prev) => [...prev, item]);
  }
  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  function salvar() {
    setErro(null);
    if (!avulso && !pacienteId) {
      setErro("Selecione um paciente ou marque venda avulsa.");
      return;
    }
    if (avulso && !clienteNome.trim()) {
      setErro("Informe o nome do cliente (avulso).");
      return;
    }
    const input: OrcamentoInput = {
      id: orcamento?.id,
      paciente_id: avulso ? null : pacienteId || null,
      cliente_nome: avulso ? clienteNome.trim() : clienteNome.trim() || null,
      cliente_telefone: clienteTelefone.trim() || null,
      cliente_email: clienteEmail.trim() || null,
      profissional_id: profissionalId || null,
      convenio_id: convenioId || null,
      tabela_preco_id: null,
      status,
      validade_dias: Number(validadeDias) || 30,
      tipo_desconto: tipoDesconto,
      desconto: Number(desconto) || 0,
      observacoes: observacoes.trim() || null,
      anotacoes_internas: anotacoes.trim() || null,
      itens: itens.map((i) => ({
        servico_id: i.servico_id,
        item_estoque_id: i.item_estoque_id,
        quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
        tipo_valor: i.tipo_valor,
        regioes: i.regioes,
        unidade: i.unidade,
        observacao: i.observacao,
      })),
    };
    startTransition(async () => {
      const r = await salvarOrcamento(input);
      if (r.erro) setErro(r.erro);
      else onSaved();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {orcamento ? "Editar orçamento" : "Novo orçamento"}
        </h2>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="mr-1 h-4 w-4" /> Voltar
        </Button>
      </div>

      {/* Cliente */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Paciente</Label>
          <Select value={avulso ? AVULSO : pacienteId} onValueChange={escolherPaciente}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o paciente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AVULSO}>Venda avulsa (sem cadastro)</SelectItem>
              {pacientes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{avulso ? "Nome do cliente" : "Nome"}</Label>
          <Input
            value={clienteNome}
            onChange={(e) => setClienteNome(e.target.value)}
            disabled={!avulso}
            placeholder={avulso ? "Nome do cliente avulso" : ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input
            value={clienteTelefone}
            onChange={(e) => setClienteTelefone(e.target.value)}
            disabled={!avulso}
          />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input
            value={clienteEmail}
            onChange={(e) => setClienteEmail(e.target.value)}
            disabled={!avulso}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Profissional</Label>
          <Select
            value={profissionalId || NENHUM}
            onValueChange={(v) => setProfissionalId(v === NENHUM ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>—</SelectItem>
              {profissionais.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Convênio</Label>
          <Select
            value={convenioId || NENHUM}
            onValueChange={(v) => setConvenioId(v === NENHUM ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Particular" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>Particular</SelectItem>
              {convenios.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusOrcamento)}>
            <SelectTrigger>
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
        </div>
        <div className="space-y-1.5">
          <Label>Validade (dias)</Label>
          <Input
            type="number"
            min={1}
            value={validadeDias}
            onChange={(e) => setValidadeDias(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Itens */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Itens</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setModalServico(true)}>
              <Plus className="mr-1 h-4 w-4" /> Serviço
            </Button>
            <Button size="sm" variant="outline" onClick={() => setModalProduto(true)}>
              <Plus className="mr-1 h-4 w-4" /> Produto
            </Button>
          </div>
        </div>

        {itens.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed border-border p-4 text-center text-sm">
            Nenhum item. Adicione serviços ou produtos.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {itens.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {it.nome}
                    {it.item_estoque_id && (
                      <span className="text-muted-foreground ml-2 text-xs">produto</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {it.quantidade} {it.unidade ?? "x"} ·{" "}
                    {it.tipo_valor === "gratuito"
                      ? "Grátis"
                      : `${TIPO_VALOR_LABEL[it.tipo_valor]} ${formatarBRL(it.valor_unitario)}`}
                    {it.regioes.length > 0 && ` · ${it.regioes.slice(0, 3).join(", ")}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">
                    {formatarBRL(
                      it.tipo_valor === "gratuito"
                        ? 0
                        : it.quantidade * it.valor_unitario
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removerItem(idx)}
                    className="text-destructive hover:opacity-70"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desconto + totais */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de desconto</Label>
              <Select
                value={tipoDesconto}
                onValueChange={(v) => setTipoDesconto(v as "percentual" | "valor")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="valor">Valor (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Desconto</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={desconto}
                onChange={(e) => setDesconto(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações (cliente)</Label>
            <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Anotações internas</Label>
            <Input value={anotacoes} onChange={(e) => setAnotacoes(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatarBRL(valorTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Desconto</span>
            <span className="text-destructive">- {formatarBRL(descontoAplicado)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatarBRL(valorFinal)}</span>
          </div>
        </div>
      </div>

      {erro && <p className="text-destructive text-sm">{erro}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={salvando}>
          Cancelar
        </Button>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar orçamento"}
        </Button>
      </div>

      <ItemOrcamentoModal
        open={modalServico}
        onOpenChange={setModalServico}
        servicos={servicos}
        tabelasPreco={tabelasPreco}
        itensTabela={itensTabela}
        convenioId={convenioId || null}
        tipoClinica={tipoClinica}
        onAdd={adicionarItem}
      />
      <ItemEstoqueOrcamentoModal
        open={modalProduto}
        onOpenChange={setModalProduto}
        produtos={produtosEstoque}
        onAdd={adicionarItem}
      />
    </div>
  );
}
