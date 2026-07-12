"use client";

// Porta de reference/base44 src/pages/Pacientes.jsx + PacienteModal.jsx.
import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Edit2, Trash2, X } from "lucide-react";

import {
  desvincularPaciente,
  salvarPaciente,
  type PacienteInput,
} from "@/lib/actions/pacientes";
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

export type OrigemConfig = { nome: string; cor: string };

type Opcao = { id: string; nome: string };

export type PacienteLinha = {
  vinculoId: string;
  convenioId: string | null;
  numeroCarteirinha: string | null;
  origem: string | null;
  id: string;
  nome: string;
  cpf: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  logradouro: string | null;
  sexo: "masculino" | "feminino" | "outro" | null;
  nome_mae: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  contato_emergencia_parentesco: string | null;
  observacoes: string | null;
  ativo: boolean;
};

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function PacientesClient({
  pacientes,
  convenios,
  origens,
  termo,
}: {
  pacientes: PacienteLinha[];
  convenios: Opcao[];
  origens: OrigemConfig[];
  termo: { singular: string; plural: string };
}) {
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<PacienteLinha | null>(null);
  const [, startTransition] = useTransition();

  const filtrados = useMemo(
    () =>
      pacientes.filter(
        (p) =>
          p.nome.toLowerCase().includes(busca.toLowerCase()) ||
          p.cpf?.includes(busca) ||
          p.telefone?.includes(busca)
      ),
    [pacientes, busca]
  );

  const corOrigem = (origem: string | null) =>
    origens.find((o) => o.nome === origem)?.cor || "bg-gray-100 text-gray-600";
  const nomeConvenio = (id: string | null) =>
    convenios.find((c) => c.id === id)?.nome || "Particular";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{termo.plural}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pacientes.length} cadastrados nesta clínica
          </p>
        </div>
        <Button
          onClick={() => {
            setSelecionado(null);
            setModalAberto(true);
          }}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" /> Novo {termo.singular}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, CPF ou telefone..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">CPF</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Telefone</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">Convênio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">Nascimento</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  Nenhum {termo.singular.toLowerCase()} encontrado.
                </td>
              </tr>
            ) : (
              filtrados.map((p) => (
                <tr key={p.vinculoId} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {p.nome[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium">{p.nome}</span>
                      {p.origem && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${corOrigem(p.origem)}`}>
                          {p.origem}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.cpf || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.telefone || "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                      {nomeConvenio(p.convenioId)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {formatarData(p.data_nascimento)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => {
                          setSelecionado(p);
                          setModalAberto(true);
                        }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            !confirm(
                              "Remover este paciente da clínica? O cadastro global é preservado."
                            )
                          )
                            return;
                          startTransition(async () => {
                            await desvincularPaciente(p.id);
                          });
                        }}
                        className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <PacienteModal
          paciente={selecionado}
          convenios={convenios}
          origens={origens}
          termoSingular={termo.singular}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  );
}

function PacienteModal({
  paciente,
  convenios,
  origens,
  termoSingular,
  onClose,
}: {
  paciente: PacienteLinha | null;
  convenios: Opcao[];
  origens: OrigemConfig[];
  termoSingular: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PacienteInput>({
    id: paciente?.id,
    nome: paciente?.nome ?? "",
    cpf: paciente?.cpf ?? "",
    data_nascimento: paciente?.data_nascimento ?? "",
    telefone: paciente?.telefone ?? "",
    email: paciente?.email ?? "",
    logradouro: paciente?.logradouro ?? "",
    sexo: paciente?.sexo ?? null,
    nome_mae: paciente?.nome_mae ?? "",
    contato_emergencia_nome: paciente?.contato_emergencia_nome ?? "",
    contato_emergencia_telefone: paciente?.contato_emergencia_telefone ?? "",
    contato_emergencia_parentesco: paciente?.contato_emergencia_parentesco ?? "",
    observacoes: paciente?.observacoes ?? "",
    ativo: paciente?.ativo ?? true,
    convenio_id: paciente?.convenioId ?? null,
    numero_carteirinha: paciente?.numeroCarteirinha ?? "",
    origem: paciente?.origem ?? null,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  function set<K extends keyof PacienteInput>(k: K, v: PacienteInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">
            {paciente ? `Editar ${termoSingular}` : `Novo ${termoSingular}`}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome completo *</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome do paciente" />
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={form.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={form.data_nascimento ?? ""} onChange={(e) => set("data_nascimento", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Endereço</Label>
              <Input value={form.logradouro ?? ""} onChange={(e) => set("logradouro", e.target.value)} placeholder="Rua, número, bairro..." />
            </div>
            <div className="space-y-1.5">
              <Label>Sexo</Label>
              <Select
                value={form.sexo ?? "nao_informado"}
                onValueChange={(v) => set("sexo", v === "nao_informado" ? null : (v as PacienteInput["sexo"]))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_informado">Não informado</SelectItem>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.ativo ? "ativo" : "inativo"} onValueChange={(v) => set("ativo", v === "ativo")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Convênio</Label>
              <Select
                value={form.convenio_id ?? "particular"}
                onValueChange={(v) => set("convenio_id", v === "particular" ? null : v)}
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
            <div className="space-y-1.5">
              <Label>Nº Carteirinha</Label>
              <Input value={form.numero_carteirinha ?? ""} onChange={(e) => set("numero_carteirinha", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Nome da Mãe</Label>
              <Input value={form.nome_mae ?? ""} onChange={(e) => set("nome_mae", e.target.value)} placeholder="Nome completo da mãe" />
            </div>
          </div>

          <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-medium">Contato de Emergência</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={form.contato_emergencia_nome ?? ""} onChange={(e) => set("contato_emergencia_nome", e.target.value)} placeholder="Nome do contato" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={form.contato_emergencia_telefone ?? ""} onChange={(e) => set("contato_emergencia_telefone", e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Parentesco</Label>
                <Input value={form.contato_emergencia_parentesco ?? ""} onChange={(e) => set("contato_emergencia_parentesco", e.target.value)} placeholder="Ex: Mãe, Cônjuge..." />
              </div>
            </div>
          </div>

          {origens.length > 0 && (
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select
                value={form.origem ?? "nenhuma"}
                onValueChange={(v) => set("origem", v === "nenhuma" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Como chegou até nós?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Não informado</SelectItem>
                  {origens.map((o) => (
                    <SelectItem key={o.nome} value={o.nome}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Input value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} placeholder="Alergias, histórico, observações..." />
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            O envio de link de anamnese chega no Sprint 2 (prontuário).
          </p>
        </div>

        {erro && <p className="px-5 pb-2 text-sm text-destructive">{erro}</p>}

        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button
            disabled={salvando}
            onClick={() =>
              startTransition(async () => {
                const r = await salvarPaciente(form);
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
