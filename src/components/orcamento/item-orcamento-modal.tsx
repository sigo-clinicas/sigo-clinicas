"use client";

// Porta de reference/base44 src/components/orcamento/ItemOrcamentoModal.jsx.
// Adiciona uma linha de SERVIÇO ao orçamento, com seleção de regiões
// (odontograma p/ odonto, mapa de estética p/ estética, texto livre p/ demais).
// Saída regioes[] → item_orcamento.regioes (persistida no S3-1).
import { useMemo, useState } from "react";

import { Odontograma } from "@/components/prontuario/odontograma";
import { MapaEstetica } from "@/components/prontuario/mapa-estetica";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

import type {
  ItemFormulario,
  ItemTabela,
  OpcaoServico,
  TabelaPreco,
  TipoValor,
} from "./tipos";
import { TIPO_VALOR_LABEL } from "./tipos";

export function ItemOrcamentoModal({
  open,
  onOpenChange,
  servicos,
  tabelasPreco,
  itensTabela,
  convenioId,
  tipoClinica,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  servicos: OpcaoServico[];
  tabelasPreco: TabelaPreco[];
  itensTabela: ItemTabela[];
  convenioId: string | null;
  tipoClinica: TipoClinica;
  onAdd: (item: ItemFormulario) => void;
}) {
  const [servicoId, setServicoId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [valorUnit, setValorUnit] = useState(0);
  const [tipoValor, setTipoValor] = useState<TipoValor>("fixo");
  const [regioes, setRegioes] = useState<string[]>([]);
  const [regioesTexto, setRegioesTexto] = useState("");
  const [observacao, setObservacao] = useState("");

  // Tabela de preço aplicável: a do convênio do orçamento, senão a sem convênio.
  const tabela = useMemo(() => {
    return (
      tabelasPreco.find((t) => t.convenio_id === convenioId) ??
      tabelasPreco.find((t) => !t.convenio_id) ??
      tabelasPreco[0] ??
      null
    );
  }, [tabelasPreco, convenioId]);

  function selecionarServico(id: string) {
    setServicoId(id);
    if (!tabela) return;
    const item = itensTabela.find(
      (it) => it.servico_id === id && it.tabela_preco_id === tabela.id
    );
    if (item) {
      setTipoValor(item.tipo_valor);
      setValorUnit(item.tipo_valor === "gratuito" ? 0 : Number(item.valor));
    }
  }

  function resetar() {
    setServicoId("");
    setQuantidade(1);
    setValorUnit(0);
    setTipoValor("fixo");
    setRegioes([]);
    setRegioesTexto("");
    setObservacao("");
  }

  function adicionar() {
    if (!servicoId) return;
    const servico = servicos.find((s) => s.id === servicoId);
    const regioesFinais =
      tipoClinica === "odontologica" || tipoClinica === "estetica"
        ? regioes
        : regioesTexto
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean);
    onAdd({
      servico_id: servicoId,
      item_estoque_id: null,
      nome: servico?.nome ?? "Serviço",
      quantidade: Number(quantidade) || 1,
      valor_unitario: tipoValor === "gratuito" ? 0 : Number(valorUnit) || 0,
      tipo_valor: tipoValor,
      regioes: regioesFinais,
      unidade: null,
      observacao: observacao.trim() || null,
    });
    resetar();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar serviço</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Serviço</Label>
            <Select value={servicoId} onValueChange={selecionarServico}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o serviço" />
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

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de valor</Label>
              <Select
                value={tipoValor}
                onValueChange={(v) => setTipoValor(v as TipoValor)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["fixo", "a_partir_de", "gratuito"] as TipoValor[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_VALOR_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor unitário (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={tipoValor === "gratuito"}
                value={tipoValor === "gratuito" ? 0 : valorUnit}
                onChange={(e) => setValorUnit(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Regiões
            </Label>
            {tipoClinica === "odontologica" ? (
              <Odontograma selecionados={regioes} onChange={setRegioes} />
            ) : tipoClinica === "estetica" ? (
              <MapaEstetica selecionados={regioes} onChange={setRegioes} />
            ) : (
              <Input
                placeholder="Ex.: coluna lombar, ombro direito"
                value={regioesTexto}
                onChange={(e) => setRegioesTexto(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={adicionar} disabled={!servicoId}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
