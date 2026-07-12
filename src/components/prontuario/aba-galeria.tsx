"use client";

// Porta de reference/base44 src/components/prontuario/AbaGaleria.jsx.
// No Base44 as fotos avulsas eram salvas num hack (avaliação "__galeria__");
// aqui há a tabela galeria_foto (D6). A galeria agrega três origens: fotos de
// avaliação, de evolução e avulsas (galeria_foto, estas removíveis pela gestão).
// Todas moram em bucket PRIVADO — cada card resolve a própria signed URL.
import { useEffect, useMemo, useState, useTransition } from "react";
import { Camera, Upload, ZoomIn, X, Columns, Layers, Trash2, Loader2 } from "lucide-react";

import {
  adicionarFotoGaleria,
  removerFotoGaleria,
  type FotoProntuario,
} from "@/lib/actions/prontuario";
import { urlAssinada } from "@/lib/storage";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const CATEGORIAS = ["antes", "depois", "evolucao", "detalhe", "outro"] as const;
type Categoria = (typeof CATEGORIAS)[number];
const ROTULO: Record<string, string> = {
  antes: "Antes",
  depois: "Depois",
  evolucao: "Evolução",
  detalhe: "Detalhe",
  outro: "Outro",
};

export type FotoAvaliacaoGrupo = { data: string; fotos: FotoProntuario[] };
export type FotoEvolucaoGrupo = { data: string; fotos: FotoProntuario[] };
export type GaleriaFotoRow = {
  id: string;
  path: string;
  categoria: string;
  descricao: string | null;
  data: string;
};

type Item = {
  key: string;
  path: string;
  categoria: string;
  origem: string;
  data: string | null;
  descricao: string | null;
  galeriaId?: string;
};

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${a}`;
}

function CartaoFoto({
  item,
  selecionada,
  onSelecionar,
  onAmpliar,
}: {
  item: Item;
  selecionada: boolean;
  onSelecionar?: () => void;
  onAmpliar: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    urlAssinada("prontuario", item.path).then((u) => vivo && setUrl(u));
    return () => {
      vivo = false;
    };
  }, [item.path]);

  return (
    <div
      className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
        selecionada ? "border-primary shadow-lg scale-105" : "border-transparent hover:border-border"
      }`}
      onClick={() => (onSelecionar ? onSelecionar() : url && onAmpliar(url))}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL de bucket privado
        <img src={url} alt={item.descricao || ""} className="w-full aspect-square object-cover" />
      ) : (
        <div className="w-full aspect-square bg-muted flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <div className="absolute top-1 left-1">
        <span className="text-xs bg-black/60 text-white px-1.5 py-0.5 rounded-full">
          {ROTULO[item.categoria] || item.origem}
        </span>
      </div>
      {item.data && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
          <p className="text-white text-xs">{fmtData(item.data)}</p>
        </div>
      )}
      {selecionada && (
        <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
          <Layers className="w-3 h-3 text-primary-foreground" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
        <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

export function AbaGaleria({
  clinicaId,
  pacienteId,
  fotosAvaliacao,
  fotosEvolucao,
  fotosGaleria,
  podeEditar,
}: {
  clinicaId: string;
  pacienteId: string;
  fotosAvaliacao: FotoAvaliacaoGrupo[];
  fotosEvolucao: FotoEvolucaoGrupo[];
  fotosGaleria: GaleriaFotoRow[];
  podeEditar: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [categoriaUpload, setCategoriaUpload] = useState<Categoria>("outro");
  const [filtro, setFiltro] = useState<string>("todas");
  const [modoComparacao, setModoComparacao] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const itens = useMemo<Item[]>(() => {
    const lista: Item[] = [];
    fotosAvaliacao.forEach((av, ai) =>
      (av.fotos ?? []).forEach((f, fi) =>
        lista.push({
          key: `av-${ai}-${fi}`,
          path: f.path,
          categoria: f.categoria ?? "outro",
          origem: "Avaliação",
          data: f.data ?? av.data,
          descricao: f.descricao ?? null,
        })
      )
    );
    fotosEvolucao.forEach((ev, ei) =>
      (ev.fotos ?? []).forEach((f, fi) =>
        lista.push({
          key: `ev-${ei}-${fi}`,
          path: f.path,
          categoria: f.categoria ?? "evolucao",
          origem: "Evolução",
          data: f.data ?? ev.data,
          descricao: f.descricao ?? null,
        })
      )
    );
    fotosGaleria.forEach((g) =>
      lista.push({
        key: `gl-${g.id}`,
        path: g.path,
        categoria: g.categoria,
        origem: "Galeria",
        data: g.data,
        descricao: g.descricao,
        galeriaId: g.id,
      })
    );
    lista.sort((a, b) => new Date(b.data ?? 0).getTime() - new Date(a.data ?? 0).getTime());
    return lista;
  }, [fotosAvaliacao, fotosEvolucao, fotosGaleria]);

  const filtradas = filtro === "todas" ? itens : itens.filter((i) => i.categoria === filtro);
  const selecionadasItens = selecionadas
    .map((k) => itens.find((i) => i.key === k))
    .filter(Boolean) as Item[];

  function toggleSelecionada(key: string) {
    setSelecionadas((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length < 2) return [...prev, key];
      return [prev[1], key];
    });
  }

  async function handleUpload(files: FileList) {
    setUploading(true);
    setErro(null);
    const supabase = createBrowserSupabase();
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "png";
      const path = `${clinicaId}/galeria/${pacienteId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("prontuario").upload(path, file, {
        contentType: file.type || "image/png",
      });
      if (error) {
        setErro("Falha ao enviar a foto.");
        continue;
      }
      const r = await adicionarFotoGaleria({
        paciente_id: pacienteId,
        path,
        categoria: categoriaUpload,
      });
      if (r.erro) setErro(r.erro);
    }
    setUploading(false);
  }

  function remover(galeriaId: string) {
    startTransition(async () => {
      const r = await removerFotoGaleria({ fotoId: galeriaId, pacienteId });
      if (r.erro) setErro(r.erro);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">{itens.length} foto(s)</span>
          <div className="flex gap-1 flex-wrap">
            {["todas", ...CATEGORIAS].map((cat) => (
              <button
                key={cat}
                onClick={() => setFiltro(cat)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filtro === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {cat === "todas" ? "Todas" : ROTULO[cat]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={modoComparacao ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => {
              setModoComparacao((m) => !m);
              setSelecionadas([]);
            }}
          >
            <Columns className="w-3.5 h-3.5" />
            {modoComparacao ? "Sair da Comparação" : "Comparar"}
          </Button>
          {podeEditar && (
            <div className="flex items-center gap-1.5">
              <select
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={categoriaUpload}
                onChange={(e) => setCategoriaUpload(e.target.value as Categoria)}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {ROTULO[c]}
                  </option>
                ))}
              </select>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? "Enviando..." : "Upload"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => e.target.files && handleUpload(e.target.files)}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {modoComparacao && selecionadasItens.length === 2 && (
        <div className="border border-border rounded-xl overflow-hidden bg-black">
          <p className="text-xs text-center text-white/60 py-1">Comparação lado a lado</p>
          <div className="grid grid-cols-2 gap-0.5">
            {selecionadasItens.map((f) => (
              <ComparacaoImg key={f.key} item={f} />
            ))}
          </div>
        </div>
      )}
      {modoComparacao && selecionadasItens.length < 2 && (
        <div className="text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl py-4">
          Selecione 2 fotos para comparar ({selecionadasItens.length}/2)
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma foto encontrada.</p>
          <p className="text-xs mt-1">Adicione fotos via Upload ou nas Avaliações/Evoluções.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {filtradas.map((item) => (
            <div key={item.key} className="relative group">
              <CartaoFoto
                item={item}
                selecionada={selecionadas.includes(item.key)}
                onSelecionar={modoComparacao ? () => toggleSelecionada(item.key) : undefined}
                onAmpliar={setAmpliada}
              />
              {podeEditar && item.galeriaId && !modoComparacao && (
                <button
                  onClick={() => remover(item.galeriaId!)}
                  className="absolute top-1 right-1 bg-destructive/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                  title="Remover foto"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {ampliada && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setAmpliada(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setAmpliada(null)}
              className="absolute -top-8 right-0 text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URL de bucket privado */}
            <img src={ampliada} alt="" className="w-full rounded-xl max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

function ComparacaoImg({ item }: { item: Item }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    urlAssinada("prontuario", item.path).then((u) => vivo && setUrl(u));
    return () => {
      vivo = false;
    };
  }, [item.path]);
  return (
    <div className="relative">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL de bucket privado
        <img src={url} alt="" className="w-full object-cover max-h-72" />
      ) : (
        <div className="w-full h-72 bg-muted flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1.5 text-center">
        {(ROTULO[item.categoria] || item.origem)} — {fmtData(item.data)}
      </div>
    </div>
  );
}
