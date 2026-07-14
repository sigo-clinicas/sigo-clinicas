"use client";

// Porta de reference/base44 Comissoes.jsx — seleciona profissional + mês,
// calcula a prévia (previaComissao), confere as linhas e gera o lançamento
// (apurarComissao → RPC). Aba de histórico com cancelamento (se não baixado).
import { useState, useTransition } from "react";

import {
  apurarComissao,
  cancelarApuracao,
  previaComissao,
  type LinhaComissao,
} from "@/lib/actions/comissoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatarBRL,
  STATUS_LANCAMENTO,
  type OpcaoSimples,
  type StatusLancamento,
} from "@/components/financeiro/tipos";
import { intervaloCompetencia } from "@/lib/comissao";

type HistLanc = {
  id: string;
  descricao: string;
  valor: number;
  valor_pago: number;
  status: StatusLancamento;
  data_vencimento: string;
  profissional_id: string | null;
};

const SEM = "__sem__";

export function ComissoesClient({
  profissionais,
  categorias,
  historico,
}: {
  profissionais: OpcaoSimples[];
  categorias: OpcaoSimples[];
  historico: HistLanc[];
}) {
  const mesAtual = new Date().toISOString().slice(0, 7);
  const [profissionalId, setProfissionalId] = useState(profissionais[0]?.id ?? "");
  const [competencia, setCompetencia] = useState(mesAtual);
  const [categoriaId, setCategoriaId] = useState<string>(SEM);
  const [linhas, setLinhas] = useState<LinhaComissao[] | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [carregando, startCarregar] = useTransition();
  const [gerando, startGerar] = useTransition();

  const nomeProf = new Map(profissionais.map((p) => [p.id, p.nome]));

  function calcular() {
    setErro(null);
    setMsg(null);
    startCarregar(async () => {
      const r = await previaComissao(profissionalId, competencia);
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      setLinhas(r.linhas);
      setSelecionadas(
        new Set(r.linhas.filter((l) => !l.ja_comissionado).map((l) => l.consulta_servico_id))
      );
    });
  }

  function toggle(id: string) {
    setSelecionadas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const selecionaveis = (linhas ?? []).filter((l) => !l.ja_comissionado);
  const total = selecionaveis
    .filter((l) => selecionadas.has(l.consulta_servico_id))
    .reduce((a, l) => a + Number(l.valor), 0);

  function gerar() {
    setErro(null);
    setMsg(null);
    const itens = selecionaveis
      .filter((l) => selecionadas.has(l.consulta_servico_id))
      .map((l) => ({
        consulta_servico_id: l.consulta_servico_id,
        consulta_id: l.consulta_id,
        base_calculo: l.base_calculo,
        tipo_comissao: l.tipo_comissao,
        valor: l.valor,
      }));
    if (itens.length === 0) {
      setErro("Selecione ao menos uma comissão.");
      return;
    }
    startGerar(async () => {
      const r = await apurarComissao({
        profissional_id: profissionalId,
        competencia,
        vencimento: intervaloCompetencia(competencia).ultimoDia,
        categoria_id: categoriaId === SEM ? null : categoriaId,
        itens,
      });
      if (r.erro) setErro(r.erro);
      else {
        setMsg("Lançamento de comissão gerado (contas a pagar).");
        setLinhas(null);
        setSelecionadas(new Set());
      }
    });
  }

  function cancelar(id: string) {
    if (!confirm("Cancelar esta apuração de comissão?")) return;
    startGerar(async () => {
      const r = await cancelarApuracao(id);
      if (r.erro) alert(r.erro);
    });
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Comissões</h1>

      <Tabs defaultValue="apurar">
        <TabsList>
          <TabsTrigger value="apurar">Apurar</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="apurar" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Profissional</Label>
              <Select value={profissionalId} onValueChange={setProfissionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {profissionais.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Competência</Label>
              <Input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria (despesa)</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM}>—</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={calcular} disabled={carregando || !profissionalId} className="w-full">
                {carregando ? "Calculando..." : "Calcular prévia"}
              </Button>
            </div>
          </div>

          {erro && <p className="text-destructive text-sm">{erro}</p>}
          {msg && <p className="text-sm text-green-600">{msg}</p>}

          {linhas && (
            <div className="space-y-3">
              {linhas.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed border-border p-6 text-center text-sm">
                  Nenhum atendimento comissionável nesta competência.
                </p>
              ) : (
                <>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {linhas.map((l) => (
                      <div
                        key={l.consulta_servico_id}
                        className="flex items-center justify-between gap-2 p-2.5"
                      >
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={l.ja_comissionado}
                            checked={
                              l.ja_comissionado || selecionadas.has(l.consulta_servico_id)
                            }
                            onChange={() => toggle(l.consulta_servico_id)}
                          />
                          <span className={l.ja_comissionado ? "text-muted-foreground" : ""}>
                            {l.descricao}
                            {l.ja_comissionado && " · já apurada"}
                          </span>
                        </label>
                        <span className="text-sm font-medium">{formatarBRL(Number(l.valor))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      Total selecionado:{" "}
                      <strong>{formatarBRL(total)}</strong>
                    </span>
                    <Button onClick={gerar} disabled={gerando || total <= 0}>
                      {gerando ? "Gerando..." : "Gerar lançamento"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="p-2 text-left">Comissão</th>
                  <th className="p-2 text-left">Profissional</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historico.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted-foreground p-4 text-center">
                      Nenhuma comissão apurada.
                    </td>
                  </tr>
                )}
                {historico.map((h) => {
                  const st = STATUS_LANCAMENTO[h.status];
                  return (
                    <tr key={h.id}>
                      <td className="p-2">{h.descricao}</td>
                      <td className="p-2">
                        {h.profissional_id ? nomeProf.get(h.profissional_id) ?? "—" : "—"}
                      </td>
                      <td className="p-2 text-right">{formatarBRL(Number(h.valor))}</td>
                      <td className="p-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${st.cor}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        {Number(h.valor_pago) === 0 && (
                          <button
                            type="button"
                            onClick={() => cancelar(h.id)}
                            className="text-destructive text-xs hover:underline"
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
