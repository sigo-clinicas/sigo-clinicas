"use client";

// Porta de reference/base44 Campanhas.jsx — CRUD + SEGMENTAÇÃO (filtros +
// preview de público-alvo). O botão "Disparar" é inerte: o disparo real de
// WhatsApp/SMS/e-mail é Fase 2 (A5, cobrança à parte).
import { useState, useTransition } from "react";
import { Plus, Send, Trash2, Users } from "lucide-react";

import {
  contarPublicoAlvo,
  excluirCampanha,
  salvarCampanha,
  type CampanhaInput,
} from "@/lib/actions/marketing";
import { CANAIS, type ConteudoCampanha, type FiltrosCampanha } from "@/lib/campanha";
import type { Json } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Campanha = {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  filtros: Json;
  canais: string[];
  conteudo: Json;
  data_agendado: string | null;
  quantidade_destinatarios: number;
  created_at: string;
};

const GENEROS = [
  { v: "masculino", l: "Masculino" },
  { v: "feminino", l: "Feminino" },
  { v: "outro", l: "Outro" },
];

export function CampanhasClient({
  campanhas,
  cidades,
}: {
  campanhas: Campanha[];
  cidades: string[];
}) {
  const [view, setView] = useState<"lista" | "form">("lista");
  const [editando, setEditando] = useState<Campanha | null>(null);
  const [, startTransition] = useTransition();

  function excluir(id: string) {
    if (!confirm("Excluir campanha?")) return;
    startTransition(() => {
      void excluirCampanha(id);
    });
  }

  if (view === "form") {
    return (
      <div className="p-4 md:p-6">
        <CampanhaForm
          campanha={editando}
          cidades={cidades}
          onDone={() => {
            setEditando(null);
            setView("lista");
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Campanhas</h1>
        <Button onClick={() => { setEditando(null); setView("form"); }}>
          <Plus className="mr-1 h-4 w-4" /> Nova campanha
        </Button>
      </div>

      {campanhas.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed border-border p-8 text-center text-sm">
          Nenhuma campanha. Crie uma para segmentar seu público.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {campanhas.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{c.nome}</p>
                  <span className="text-muted-foreground text-xs capitalize">{c.status}</span>
                </div>
                <button type="button" onClick={() => excluir(c.id)} className="text-destructive p-1 hover:opacity-70">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {c.descricao && <p className="text-muted-foreground mt-1 text-sm">{c.descricao}</p>}
              <p className="text-muted-foreground mt-2 flex items-center gap-1 text-sm">
                <Users className="h-4 w-4" /> {c.quantidade_destinatarios} destinatário(s)
                {c.canais.length > 0 && ` · ${c.canais.join(", ")}`}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditando(c); setView("form"); }}>
                  Editar
                </Button>
                <Button size="sm" variant="outline" disabled title="Disparo real: Fase 2">
                  <Send className="mr-1 h-3.5 w-3.5" /> Disparar (F2)
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampanhaForm({
  campanha,
  cidades,
  onDone,
}: {
  campanha: Campanha | null;
  cidades: string[];
  onDone: () => void;
}) {
  const f0 = (campanha?.filtros as FiltrosCampanha | null) ?? {};
  const c0 = (campanha?.conteudo as ConteudoCampanha | null) ?? {};
  const [nome, setNome] = useState(campanha?.nome ?? "");
  const [descricao, setDescricao] = useState(campanha?.descricao ?? "");
  const [canais, setCanais] = useState<string[]>(campanha?.canais ?? []);
  const [idadeMin, setIdadeMin] = useState<string>(String(f0.demograficos?.idade_minima ?? ""));
  const [idadeMax, setIdadeMax] = useState<string>(String(f0.demograficos?.idade_maxima ?? ""));
  const [generos, setGeneros] = useState<string[]>(f0.demograficos?.generos ?? []);
  const [locs, setLocs] = useState<string[]>(f0.demograficos?.localizacoes ?? []);
  const [aniversarioMes, setAniversarioMes] = useState<string>(String(f0.temporais?.aniversario_mes ?? ""));
  const [semVisita, setSemVisita] = useState<string>(String(f0.status_paciente?.sem_visita_dias ?? ""));
  const [semCompra, setSemCompra] = useState<boolean>(f0.compra?.sem_compra ?? false);
  const [emailAssunto, setEmailAssunto] = useState(c0.email?.assunto ?? "");
  const [emailCorpo, setEmailCorpo] = useState(c0.email?.corpo ?? "");
  const [smsMsg, setSmsMsg] = useState(c0.sms?.mensagem ?? "");
  const [whatsMsg, setWhatsMsg] = useState(c0.whatsapp?.mensagem ?? "");
  const [total, setTotal] = useState<number | null>(campanha?.quantidade_destinatarios ?? null);
  const [erro, setErro] = useState<string | null>(null);
  const [calculando, startCalc] = useTransition();
  const [salvando, startSalvar] = useTransition();

  function montarFiltros(): FiltrosCampanha {
    return {
      demograficos: {
        idade_minima: idadeMin ? Number(idadeMin) : null,
        idade_maxima: idadeMax ? Number(idadeMax) : null,
        generos,
        localizacoes: locs,
      },
      temporais: { aniversario_mes: aniversarioMes ? Number(aniversarioMes) : null },
      status_paciente: { sem_visita_dias: semVisita ? Number(semVisita) : null },
      compra: { sem_compra: semCompra },
    };
  }
  function montarConteudo(): ConteudoCampanha {
    return {
      email: { assunto: emailAssunto, corpo: emailCorpo },
      sms: { mensagem: smsMsg },
      whatsapp: { mensagem: whatsMsg },
    };
  }

  function calcular() {
    setErro(null);
    startCalc(async () => {
      const r = await contarPublicoAlvo(montarFiltros() as unknown as Json);
      if (r.erro) setErro(r.erro);
      else setTotal(r.total ?? 0);
    });
  }

  function salvar() {
    setErro(null);
    if (!nome.trim()) { setErro("Informe o nome da campanha."); return; }
    const input: CampanhaInput = {
      id: campanha?.id,
      nome,
      descricao: descricao || null,
      filtros: montarFiltros() as unknown as Json,
      canais,
      conteudo: montarConteudo() as unknown as Json,
    };
    startSalvar(async () => {
      const r = await salvarCampanha(input);
      if (r.erro) setErro(r.erro);
      else onDone();
    });
  }

  function toggle<T>(arr: T[], v: T, set: (a: T[]) => void) {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{campanha ? "Editar" : "Nova"} campanha</h2>
        <Button variant="outline" size="sm" onClick={onDone}>Voltar</Button>
      </div>

      {/* Geral */}
      <section className="space-y-3">
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Canais</Label>
          <div className="flex gap-2">
            {CANAIS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggle(canais, c, setCanais)}
                className={`rounded-full border px-3 py-1 text-sm capitalize ${canais.includes(c) ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Filtros / segmentação */}
      <section className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Segmentação</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Idade mín.</Label>
            <Input type="number" value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Idade máx.</Label>
            <Input type="number" value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Aniversário (mês)</Label>
            <Input type="number" min={1} max={12} value={aniversarioMes} onChange={(e) => setAniversarioMes(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sem visita (dias)</Label>
            <Input type="number" value={semVisita} onChange={(e) => setSemVisita(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Gênero</Label>
          <div className="flex gap-2">
            {GENEROS.map((g) => (
              <button
                key={g.v}
                type="button"
                onClick={() => toggle(generos, g.v, setGeneros)}
                className={`rounded-full border px-3 py-1 text-sm ${generos.includes(g.v) ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {g.l}
              </button>
            ))}
          </div>
        </div>
        {cidades.length > 0 && (
          <div className="space-y-1.5">
            <Label>Cidades</Label>
            <div className="flex flex-wrap gap-2">
              {cidades.slice(0, 20).map((cid) => (
                <button
                  key={cid}
                  type="button"
                  onClick={() => toggle(locs, cid, setLocs)}
                  className={`rounded-full border px-3 py-1 text-sm ${locs.includes(cid) ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {cid}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={semCompra} onChange={(e) => setSemCompra(e.target.checked)} />
          Somente quem nunca comprou
        </label>
        <div className="flex items-center gap-3 border-t border-border pt-3">
          <Button size="sm" variant="outline" onClick={calcular} disabled={calculando}>
            {calculando ? "Calculando..." : "Calcular público-alvo"}
          </Button>
          {total != null && (
            <span className="flex items-center gap-1 text-sm font-medium">
              <Users className="h-4 w-4" /> {total} destinatário(s)
            </span>
          )}
        </div>
      </section>

      {/* Conteúdo por canal */}
      {canais.includes("email") && (
        <section className="space-y-2 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">E-mail</h3>
          <Input placeholder="Assunto" value={emailAssunto} onChange={(e) => setEmailAssunto(e.target.value)} />
          <Input placeholder="Corpo" value={emailCorpo} onChange={(e) => setEmailCorpo(e.target.value)} />
        </section>
      )}
      {canais.includes("sms") && (
        <section className="space-y-2 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">SMS</h3>
          <Input placeholder="Mensagem" value={smsMsg} onChange={(e) => setSmsMsg(e.target.value)} />
        </section>
      )}
      {canais.includes("whatsapp") && (
        <section className="space-y-2 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">WhatsApp</h3>
          <Input placeholder="Mensagem" value={whatsMsg} onChange={(e) => setWhatsMsg(e.target.value)} />
          <p className="text-muted-foreground text-xs">O disparo real é Fase 2 (cobrança à parte).</p>
        </section>
      )}

      {erro && <p className="text-destructive text-sm">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={salvando}>Cancelar</Button>
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar campanha"}</Button>
      </div>
    </div>
  );
}
