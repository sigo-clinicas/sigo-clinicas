"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus } from "lucide-react";

import {
  alternarAtivoEspecialidade,
  criarEspecialidade,
  criarSegmento,
  type EstadoEspecialidades,
} from "@/lib/actions/especialidades";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type Segmento = { id: string; nome: string; ativo: boolean };
type Especialidade = {
  id: string;
  segmento_id: string;
  nome: string;
  ativo: boolean;
};

const estadoInicial: EstadoEspecialidades = { erro: null };

function BotaoAdicionar({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      <Plus className="w-4 h-4 mr-1" />
      {pending ? "Salvando..." : rotulo}
    </Button>
  );
}

export function EspecialidadesAdminClient({
  segmentos,
  especialidades,
}: {
  segmentos: Segmento[];
  especialidades: Especialidade[];
}) {
  const [segmentoAtivo, setSegmentoAtivo] = useState<string>(
    segmentos[0]?.id ?? ""
  );
  const [estadoSegmento, dispatchSegmento] = useFormState(
    criarSegmento,
    estadoInicial
  );
  const [estadoEspecialidade, dispatchEspecialidade] = useFormState(
    criarEspecialidade,
    estadoInicial
  );
  const [, startTransition] = useTransition();

  const daSelecao = especialidades.filter(
    (e) => e.segmento_id === segmentoAtivo
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Segmentos e Especialidades</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Taxonomia global da plataforma — usada na busca do marketplace e nos
          cadastros de clínicas e profissionais.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segmentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              {segmentos.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSegmentoAtivo(s.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                    segmentoAtivo === s.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <span>{s.nome}</span>
                  <Badge variant="secondary">
                    {especialidades.filter((e) => e.segmento_id === s.id).length}
                  </Badge>
                </button>
              ))}
            </div>
            <form action={dispatchSegmento} className="flex gap-2 pt-2 border-t">
              <Input name="nome" placeholder="Novo segmento" required />
              <BotaoAdicionar rotulo="Criar" />
            </form>
            {estadoSegmento.erro && (
              <p className="text-sm text-destructive">{estadoSegmento.erro}</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Especialidades{" "}
              <span className="text-muted-foreground font-normal">
                ({segmentos.find((s) => s.id === segmentoAtivo)?.nome ?? "—"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form action={dispatchEspecialidade} className="flex gap-2">
              <input type="hidden" name="segmento_id" value={segmentoAtivo} />
              <Input name="nome" placeholder="Nova especialidade" required />
              <BotaoAdicionar rotulo="Adicionar" />
            </form>
            {estadoEspecialidade.erro && (
              <p className="text-sm text-destructive">
                {estadoEspecialidade.erro}
              </p>
            )}
            <div className="divide-y divide-border">
              {daSelecao.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <span
                    className={`text-sm ${e.ativo ? "" : "text-muted-foreground line-through"}`}
                  >
                    {e.nome}
                  </span>
                  <Switch
                    checked={e.ativo}
                    onCheckedChange={(v) =>
                      startTransition(async () => {
                        await alternarAtivoEspecialidade(e.id, v);
                      })
                    }
                  />
                </div>
              ))}
              {daSelecao.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma especialidade neste segmento.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
