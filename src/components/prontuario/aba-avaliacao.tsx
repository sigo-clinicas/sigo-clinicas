"use client";

// Porta de reference/base44 src/components/prontuario/AbaAvaliacaoClinica.jsx
// (FormAvaliacao). Diferenças: fotos vão para o bucket PRIVADO `prontuario`
// (grava path, exibe via signed URL server-side — A8); sem DELETE (registro
// clínico é retido — retention-lock S2-0).
import { useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Camera, X, Loader2 } from "lucide-react";

import { salvarAvaliacao, type AvaliacaoInput, type FotoProntuario } from "@/lib/actions/prontuario";
import { urlAssinada } from "@/lib/storage";
import { createBrowserSupabase } from "@/lib/supabase/browser";
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

export type AvaliacaoLinha = {
  id: string;
  paciente_id: string;
  profissional_id: string | null;
  data: string;
  queixa_principal: string | null;
  historia_doenca_atual: string | null;
  historico_familiar: string | null;
  revisao_sistemas: string | null;
  pressao_arterial: string | null;
  frequencia_cardiaca: string | null;
  peso: number | null;
  altura: number | null;
  exame_especifico: string | null;
  resultados_exames: string | null;
  hipotese_diagnostica: string | null;
  plano_terapeutico: string | null;
  fotos: FotoProntuario[] | null;
};

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${a}`;
}

function FotoThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    urlAssinada("prontuario", path).then(setUrl);
  }, [path]);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL de bucket privado; next/image não cabe (URL temporária, host dinâmico)
    <img src={url} alt="Foto da avaliação" className="w-20 h-20 object-cover rounded-lg border border-border" />
  ) : (
    <div className="w-20 h-20 rounded-lg border border-border bg-muted flex items-center justify-center">
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    </div>
  );
}

export function AbaAvaliacao({
  clinicaId,
  pacienteId,
  avaliacoes,
  profissionais,
  podeEditar,
}: {
  clinicaId: string;
  pacienteId: string;
  avaliacoes: AvaliacaoLinha[];
  profissionais: { id: string; nome: string }[];
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState<AvaliacaoLinha | "nova" | null>(null);

  if (editando !== null) {
    return (
      <FormAvaliacao
        clinicaId={clinicaId}
        pacienteId={pacienteId}
        avaliacao={editando === "nova" ? null : editando}
        profissionais={profissionais}
        onClose={() => setEditando(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{avaliacoes.length} avaliação(ões)</p>
        {podeEditar && (
          <Button size="sm" className="gap-1.5" onClick={() => setEditando("nova")}>
            <Plus className="w-3.5 h-3.5" /> Nova Avaliação
          </Button>
        )}
      </div>

      {avaliacoes.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
          <p className="text-sm">Nenhuma avaliação registrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {avaliacoes.map((av) => {
            const prof = profissionais.find((p) => p.id === av.profissional_id);
            return (
              <div key={av.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-sm">{fmtData(av.data)}</div>
                    {prof && <div className="text-xs text-muted-foreground">{prof.nome}</div>}
                  </div>
                  {podeEditar && (
                    <button
                      onClick={() => setEditando(av)}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {av.queixa_principal && (
                  <p className="text-sm mt-2">
                    <span className="text-muted-foreground">Queixa:</span> {av.queixa_principal}
                  </p>
                )}
                {av.hipotese_diagnostica && (
                  <p className="text-sm mt-1">
                    <span className="text-muted-foreground">Hipótese:</span> {av.hipotese_diagnostica}
                  </p>
                )}
                {Array.isArray(av.fotos) && av.fotos.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {av.fotos.map((f, i) => (
                      <FotoThumb key={i} path={f.path} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  textarea,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {textarea ? (
        <textarea
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function FormAvaliacao({
  clinicaId,
  pacienteId,
  avaliacao,
  profissionais,
  onClose,
}: {
  clinicaId: string;
  pacienteId: string;
  avaliacao: AvaliacaoLinha | null;
  profissionais: { id: string; nome: string }[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<AvaliacaoInput>({
    id: avaliacao?.id,
    paciente_id: pacienteId,
    profissional_id: avaliacao?.profissional_id ?? null,
    data: avaliacao?.data?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    queixa_principal: avaliacao?.queixa_principal ?? "",
    historia_doenca_atual: avaliacao?.historia_doenca_atual ?? "",
    historico_familiar: avaliacao?.historico_familiar ?? "",
    revisao_sistemas: avaliacao?.revisao_sistemas ?? "",
    pressao_arterial: avaliacao?.pressao_arterial ?? "",
    frequencia_cardiaca: avaliacao?.frequencia_cardiaca ?? "",
    peso: avaliacao?.peso ?? null,
    altura: avaliacao?.altura ?? null,
    exame_especifico: avaliacao?.exame_especifico ?? "",
    resultados_exames: avaliacao?.resultados_exames ?? "",
    hipotese_diagnostica: avaliacao?.hipotese_diagnostica ?? "",
    plano_terapeutico: avaliacao?.plano_terapeutico ?? "",
    fotos: avaliacao?.fotos ?? [],
  });
  const [erro, setErro] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, startTransition] = useTransition();

  function set<K extends keyof AvaliacaoInput>(k: K, v: AvaliacaoInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function uploadFoto(file: File) {
    setEnviandoFoto(true);
    setErro(null);
    const ext = file.name.split(".").pop() || "png";
    // path começa com clinica_id (exigência da storage policy)
    const path = `${clinicaId}/avaliacoes/${pacienteId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createBrowserSupabase();
    const { error } = await supabase.storage.from("prontuario").upload(path, file, {
      contentType: file.type || "image/png",
    });
    setEnviandoFoto(false);
    if (error) {
      setErro("Falha ao enviar a foto.");
      return;
    }
    set("fotos", [
      ...form.fotos,
      { path, descricao: "", data: new Date().toISOString().slice(0, 10), categoria: "outro" },
    ]);
  }

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
        ← Voltar
      </button>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Data *" value={form.data} onChange={(v) => set("data", v)} type="date" />
        <div className="space-y-1.5">
          <Label className="text-xs">Profissional</Label>
          <Select
            value={form.profissional_id ?? "nenhum"}
            onValueChange={(v) => set("profissional_id", v === "nenhum" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">—</SelectItem>
              {profissionais.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="border border-border rounded-xl p-4 space-y-3">
        <legend className="text-xs font-semibold text-muted-foreground px-1">Sinais Vitais</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Campo label="Pressão Arterial" value={form.pressao_arterial ?? ""} onChange={(v) => set("pressao_arterial", v)} />
          <Campo label="Freq. Cardíaca" value={form.frequencia_cardiaca ?? ""} onChange={(v) => set("frequencia_cardiaca", v)} />
          <Campo label="Peso (kg)" value={form.peso?.toString() ?? ""} onChange={(v) => set("peso", v === "" ? null : Number(v))} type="number" />
          <Campo label="Altura (cm)" value={form.altura?.toString() ?? ""} onChange={(v) => set("altura", v === "" ? null : Number(v))} type="number" />
        </div>
      </fieldset>

      <fieldset className="border border-border rounded-xl p-4 space-y-3">
        <legend className="text-xs font-semibold text-muted-foreground px-1">Anamnese</legend>
        <Campo label="Queixa Principal" value={form.queixa_principal ?? ""} onChange={(v) => set("queixa_principal", v)} textarea />
        <Campo label="História da Doença Atual" value={form.historia_doenca_atual ?? ""} onChange={(v) => set("historia_doenca_atual", v)} textarea />
        <Campo label="Histórico Familiar / Alergias / Cirurgias" value={form.historico_familiar ?? ""} onChange={(v) => set("historico_familiar", v)} textarea />
        <Campo label="Revisão de Sistemas" value={form.revisao_sistemas ?? ""} onChange={(v) => set("revisao_sistemas", v)} textarea />
      </fieldset>

      <fieldset className="border border-border rounded-xl p-4 space-y-3">
        <legend className="text-xs font-semibold text-muted-foreground px-1">Exame Físico</legend>
        <Campo label="Exame Específico" value={form.exame_especifico ?? ""} onChange={(v) => set("exame_especifico", v)} textarea />
        <Campo label="Resultados de Exames" value={form.resultados_exames ?? ""} onChange={(v) => set("resultados_exames", v)} textarea />
      </fieldset>

      <fieldset className="border border-border rounded-xl p-4 space-y-3">
        <legend className="text-xs font-semibold text-muted-foreground px-1">Diagnóstico e Plano</legend>
        <Campo label="Hipótese Diagnóstica" value={form.hipotese_diagnostica ?? ""} onChange={(v) => set("hipotese_diagnostica", v)} textarea />
        <Campo label="Plano Terapêutico" value={form.plano_terapeutico ?? ""} onChange={(v) => set("plano_terapeutico", v)} textarea />
      </fieldset>

      <fieldset className="border border-border rounded-xl p-4 space-y-3">
        <legend className="text-xs font-semibold text-muted-foreground px-1">Registro Fotográfico</legend>
        <div className="flex gap-2 flex-wrap items-center">
          {form.fotos.map((f, i) => (
            <div key={i} className="relative">
              <FotoThumb path={f.path} />
              <button
                onClick={() => set("fotos", form.fotos.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/40">
            {enviandoFoto ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <Camera className="w-5 h-5 text-muted-foreground" />
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={enviandoFoto}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFoto(file);
              }}
            />
          </label>
        </div>
      </fieldset>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={salvando}
          onClick={() =>
            startTransition(async () => {
              const r = await salvarAvaliacao(form);
              if (r.erro) setErro(r.erro);
              else onClose();
            })
          }
        >
          {salvando ? "Salvando..." : "Salvar Avaliação"}
        </Button>
      </div>
    </div>
  );
}
