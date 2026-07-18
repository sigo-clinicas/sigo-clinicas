"use client";

// S4-2 — Config de destaque por clínica (admin). Liga à estrutura parametrizável
// do S3-6 (nivel_destaque + marketplace_ranking_score). SEM lógica de cobrança —
// só nível + score; o modelo comercial pluga depois (decisão da cliente).
import { useState, useTransition } from "react";

import { salvarDestaque } from "@/lib/actions/marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Nivel = "neutro" | "parceiro" | "premium";
type Linha = {
  id: string;
  nome: string;
  cidade: string | null;
  ranking: number;
  destaque: {
    nivel: Nivel;
    score_manual: number;
    ativo: boolean;
    vigencia_inicio?: string | null;
    vigencia_fim?: string | null;
  } | null;
};

type EstadoLinha = {
  nivel: Nivel;
  score: number;
  ativo: boolean;
  vigencia_inicio: string;
  vigencia_fim: string;
};

export function DestaqueClient({ linhas }: { linhas: Linha[] }) {
  const [estado, setEstado] = useState<Record<string, EstadoLinha>>(
    Object.fromEntries(
      linhas.map((l) => [
        l.id,
        {
          nivel: l.destaque?.nivel ?? "neutro",
          score: l.destaque?.score_manual ?? 0,
          ativo: l.destaque?.ativo ?? true,
          vigencia_inicio: l.destaque?.vigencia_inicio ?? "",
          vigencia_fim: l.destaque?.vigencia_fim ?? "",
        },
      ])
    )
  );
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function set(id: string, patch: Partial<EstadoLinha>) {
    setEstado((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  }

  function salvar(id: string) {
    const v = estado[id];
    setSalvandoId(id);
    setMsg(null);
    startTransition(async () => {
      const r = await salvarDestaque({
        clinica_id: id,
        nivel: v.nivel,
        score_manual: v.score,
        ativo: v.ativo,
        vigencia_inicio: v.vigencia_inicio || null,
        vigencia_fim: v.vigencia_fim || null,
      });
      setSalvandoId(null);
      setMsg(r.erro ?? "Destaque atualizado.");
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Destaque no marketplace</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Nível e score de ranqueamento por clínica. O modelo de cobrança do
        destaque é decisão pendente — aqui só a estrutura.
      </p>
      {msg && <p className="mt-3 text-sm text-green-600">{msg}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="p-2 text-left">Clínica</th>
              <th className="p-2 text-right">Ranking</th>
              <th className="p-2 text-left">Nível</th>
              <th className="p-2 text-left">Score</th>
              <th className="p-2 text-left">Vigência</th>
              <th className="p-2 text-center">Ativo</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted-foreground p-4 text-center">
                  Nenhuma clínica pública no marketplace.
                </td>
              </tr>
            )}
            {linhas.map((l) => {
              const v = estado[l.id];
              return (
                <tr key={l.id}>
                  <td className="p-2">
                    <p className="font-medium">{l.nome}</p>
                    {l.cidade && <p className="text-muted-foreground text-xs">{l.cidade}</p>}
                  </td>
                  <td className="p-2 text-right">{l.ranking.toFixed(1)}</td>
                  <td className="p-2">
                    <Select value={v.nivel} onValueChange={(x) => set(l.id, { nivel: x as Nivel })}>
                      <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["neutro", "parceiro", "premium"] as Nivel[]).map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      className="h-8 w-20"
                      value={v.score}
                      onChange={(e) => set(l.id, { score: Number(e.target.value) })}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <Input
                        type="date"
                        className="h-8 w-[130px] text-xs"
                        value={v.vigencia_inicio}
                        onChange={(e) => set(l.id, { vigencia_inicio: e.target.value })}
                      />
                      <span className="text-muted-foreground text-xs">–</span>
                      <Input
                        type="date"
                        className="h-8 w-[130px] text-xs"
                        value={v.vigencia_fim}
                        onChange={(e) => set(l.id, { vigencia_fim: e.target.value })}
                      />
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={v.ativo}
                      onChange={(e) => set(l.id, { ativo: e.target.checked })}
                    />
                  </td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="outline" disabled={salvandoId === l.id} onClick={() => salvar(l.id)}>
                      {salvandoId === l.id ? "..." : "Salvar"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
