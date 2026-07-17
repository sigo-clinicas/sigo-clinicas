"use client";

// Porta de reference/base44 src/pages/Configuracoes.jsx (client).
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  Settings,
  User,
  Shield,
  Stethoscope,
  Sparkles,
  Smile,
  DollarSign,
  Bell,
  Tag,
  Plus,
  Trash2,
  Leaf,
  GraduationCap,
  Clock,
} from "lucide-react";

import type { Papel } from "@/lib/auth";
import type { TipoClinica } from "@/lib/terminologia";
import {
  atualizarConfigClinica,
  atualizarDadosClinica,
  salvarHorarios,
  uploadLogoClinica,
  type EstadoClinica,
} from "@/lib/actions/clinica";
import { DIAS_SEMANA } from "@/lib/horario";
import { urlLogoPublica } from "@/lib/tipo-clinica";
import { salvarEspecialidadesClinica } from "@/lib/actions/especialidades";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ConfigClinica = {
  id: string;
  nome: string;
  tipo: TipoClinica;
  razao_social: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  uf: string | null;
  cidade: string | null;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  sobre: string | null;
  slug: string | null;
  logo_path: string | null;
  exibir_marketplace: boolean;
  config: {
    base_comissao?: "por_agendamento" | "por_evolucao";
    lembretes?: { h24?: boolean; h12?: boolean; h2?: boolean };
    canais?: { whatsapp?: boolean; sms?: boolean; email?: boolean };
    origens_pacientes?: { nome: string; cor: string }[];
  } | null;
};

const TIPOS_CLINICA: {
  id: TipoClinica;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "medica", label: "Clínica Médica", desc: "Pacientes, consultas, convênios médicos", icon: Stethoscope },
  { id: "estetica", label: "Clínica Estética", desc: "Clientes, atendimentos, pacotes e procedimentos estéticos", icon: Sparkles },
  { id: "odontologica", label: "Clínica Odontológica", desc: "Pacientes, planos de tratamento e odontograma", icon: Smile },
  { id: "terapias", label: "Terapias Complementares e Bem-Estar", desc: "Clientes, sessões, massagem, acupuntura, yoga e afins", icon: Leaf },
];

// Papéis reais do RBAC (Base44 listava admin/gestor/recepcionista/profissional)
const PAPEIS = [
  { papel: "proprietario", label: "Proprietário", desc: "Acesso total à clínica — configurações, usuários, financeiro, relatórios, pacientes e agenda." },
  { papel: "gerente", label: "Gerente", desc: "Gestão completa exceto o cadastro da clínica. Financeiro, relatórios e equipe." },
  { papel: "recepcionista", label: "Recepcionista", desc: "Agenda, cadastro de pacientes, orçamentos e vendas. Sem financeiro gerencial." },
  { papel: "assistente", label: "Assistente", desc: "Apoio à recepção e ao atendimento: agenda, pacientes, orçamentos e vendas." },
  { papel: "profissional", label: "Profissional de Saúde", desc: "Sua agenda, seus pacientes e prontuários. Sem acesso ao financeiro." },
];

const ORIGENS_PADRAO = [
  { nome: "Instagram", cor: "bg-pink-100 text-pink-700" },
  { nome: "Facebook", cor: "bg-blue-100 text-blue-700" },
  { nome: "Google", cor: "bg-yellow-100 text-yellow-700" },
  { nome: "Indicação", cor: "bg-green-100 text-green-700" },
  { nome: "WhatsApp", cor: "bg-emerald-100 text-emerald-700" },
];

const CORES_NOVAS = [
  "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700",
  "bg-cyan-100 text-cyan-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
];

const estadoInicial: EstadoClinica = { erro: null };

function BotaoSalvar({ salvo }: { salvo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : salvo ? "✓ Salvo!" : "Salvar Configurações"}
    </Button>
  );
}

export function ConfiguracoesClient({
  clinica,
  podeEditar,
  podeEditarEspecialidades,
  segmentos,
  especialidades,
  especialidadesSelecionadas,
  horarios,
  usuario,
}: {
  clinica: ConfigClinica;
  podeEditar: boolean;
  podeEditarEspecialidades: boolean;
  segmentos: { id: string; nome: string }[];
  especialidades: { id: string; segmento_id: string; nome: string }[];
  especialidadesSelecionadas: string[];
  horarios: { dia_semana: number; abertura: string; fechamento: string }[];
  usuario: { nome: string; email: string; papel: Papel };
}) {
  const cfg = clinica.config ?? {};
  const [tab, setTab] = useState("perfil");
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoClinica>(clinica.tipo);
  const [exibirMkt, setExibirMkt] = useState(clinica.exibir_marketplace);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [enviandoLogo, startLogo] = useTransition();
  const logoUrl = urlLogoPublica(clinica.logo_path);
  const [estadoDados, dispatchDados] = useFormState(atualizarDadosClinica, estadoInicial);
  const [baseComissao, setBaseComissao] = useState(cfg.base_comissao ?? "por_agendamento");
  const [lembretes, setLembretes] = useState({
    h24: cfg.lembretes?.h24 ?? true,
    h12: cfg.lembretes?.h12 ?? false,
    h2: cfg.lembretes?.h2 ?? true,
  });
  const [canais, setCanais] = useState({
    whatsapp: cfg.canais?.whatsapp ?? true,
    sms: cfg.canais?.sms ?? false,
    email: cfg.canais?.email ?? true,
  });
  const [origens, setOrigens] = useState(cfg.origens_pacientes ?? ORIGENS_PADRAO);
  const [novaOrigem, setNovaOrigem] = useState("");
  // S5 — editor de horário: 7 linhas fixas (dia 0-6). Dia sem `aberto` = fechado.
  const [horas, setHoras] = useState(() =>
    Array.from({ length: 7 }, (_, dia) => {
      const h = horarios.find((x) => x.dia_semana === dia);
      return {
        aberto: Boolean(h),
        abertura: h ? h.abertura.slice(0, 5) : "09:00",
        fechamento: h ? h.fechamento.slice(0, 5) : "18:00",
      };
    })
  );
  const [salvoHorario, setSalvoHorario] = useState(false);
  const [erroHorario, setErroHorario] = useState<string | null>(null);
  const [pendenteHorario, startHorario] = useTransition();

  function setDia(dia: number, patch: Partial<{ aberto: boolean; abertura: string; fechamento: string }>) {
    setHoras((prev) => prev.map((h, i) => (i === dia ? { ...h, ...patch } : h)));
  }

  function salvarHorariosClick() {
    startHorario(async () => {
      const payload = horas
        .map((h, dia) => ({ dia, h }))
        .filter(({ h }) => h.aberto)
        .map(({ dia, h }) => ({ dia_semana: dia, abertura: h.abertura, fechamento: h.fechamento }));
      const r = await salvarHorarios(payload);
      setErroHorario(r.erro);
      if (!r.erro) {
        setSalvoHorario(true);
        setTimeout(() => setSalvoHorario(false), 2000);
      }
    });
  }
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    new Set(especialidadesSelecionadas)
  );
  const [salvo, setSalvo] = useState(false);
  const [erroConfig, setErroConfig] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function salvarConfig(patch: Record<string, unknown>) {
    startTransition(async () => {
      const resultado = await atualizarConfigClinica(patch);
      setErroConfig(resultado.erro);
      if (!resultado.erro) {
        setSalvo(true);
        setTimeout(() => setSalvo(false), 2000);
      }
    });
  }

  function adicionarOrigem() {
    if (!novaOrigem.trim()) return;
    setOrigens((prev) => [
      ...prev,
      { nome: novaOrigem.trim(), cor: CORES_NOVAS[prev.length % CORES_NOVAS.length] },
    ]);
    setNovaOrigem("");
  }

  // Aba "Especialidades" é ADIÇÃO ao Base44 (multisseleção dinâmica —
  // decisão da call de 02/07; lá especialidade era string livre, A4)
  const tabs = [
    { id: "perfil", label: "Perfil", icon: User },
    { id: "clinica", label: "Clínica", icon: Settings },
    { id: "especialidades", label: "Especialidades", icon: GraduationCap },
    { id: "horarios", label: "Horários", icon: Clock },
    { id: "financeiro", label: "Financeiro", icon: DollarSign },
    { id: "notificacoes", label: "Notificações", icon: Bell },
    { id: "origens", label: "Origens", icon: Tag },
    { id: "permissoes", label: "Permissões", icon: Shield },
  ];

  const rotuloBotao = pendente ? "Salvando..." : salvo ? "✓ Salvo!" : "Salvar Configurações";

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie o sistema e suas preferências
        </p>
      </div>

      <div className="flex gap-6">
        <div className="w-48 shrink-0 space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-card rounded-xl border border-border p-6">
          {tab === "perfil" && (
            <div className="space-y-5 max-w-md">
              <h2 className="text-base font-semibold">Meu Perfil</h2>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                  {usuario.nome[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <p className="font-semibold">{usuario.nome}</p>
                  <p className="text-sm text-muted-foreground">{usuario.email}</p>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-1 inline-block capitalize">
                    {usuario.papel}
                  </span>
                </div>
              </div>
              <div className="pt-4 border-t border-border text-sm text-muted-foreground">
                <p>Para alterar a senha, use &quot;Esqueci minha senha&quot; na tela de login.</p>
              </div>
            </div>
          )}

          {tab === "clinica" && (
            <form action={dispatchDados} className="space-y-6 max-w-lg">
              <div>
                <h2 className="text-base font-semibold">Tipo de Estabelecimento</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Define a terminologia e funcionalidades disponíveis no sistema.
                </p>
                <input type="hidden" name="tipo" value={tipoSelecionado} />
                <div className="grid grid-cols-1 gap-3 mt-4">
                  {TIPOS_CLINICA.map((t) => {
                    const Icon = t.icon;
                    const selected = tipoSelecionado === t.id;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        disabled={!podeEditar}
                        onClick={() => setTipoSelecionado(t.id)}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all disabled:opacity-60 ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{t.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                        </div>
                        {selected && (
                          <div className="ml-auto w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border pt-5 space-y-3">
                <h2 className="text-base font-semibold">Dados do Estabelecimento</h2>
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input name="nome" defaultValue={clinica.nome} placeholder="Ex: Clínica Bella Estética" disabled={!podeEditar} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Razão social</Label>
                    <Input name="razao_social" defaultValue={clinica.razao_social ?? ""} disabled={!podeEditar} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CNPJ</Label>
                    <Input name="cnpj" defaultValue={clinica.cnpj ?? ""} placeholder="00.000.000/0001-00" disabled={!podeEditar} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input name="telefone" defaultValue={clinica.telefone ?? ""} placeholder="(00) 0000-0000" disabled={!podeEditar} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" name="email" defaultValue={clinica.email ?? ""} placeholder="contato@clinica.com" disabled={!podeEditar} />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-5 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Endereço</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>CEP</Label>
                    <Input name="cep" defaultValue={clinica.cep ?? ""} disabled={!podeEditar} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Logradouro</Label>
                    <Input name="endereco" defaultValue={clinica.logradouro ?? ""} placeholder="Rua/Av..." disabled={!podeEditar} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Número</Label>
                    <Input name="numero" defaultValue={clinica.numero ?? ""} disabled={!podeEditar} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Complemento</Label>
                    <Input name="complemento" defaultValue={clinica.complemento ?? ""} disabled={!podeEditar} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bairro</Label>
                    <Input name="bairro" defaultValue={clinica.bairro ?? ""} disabled={!podeEditar} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cidade</Label>
                    <Input name="cidade" defaultValue={clinica.cidade ?? ""} placeholder="São Paulo" disabled={!podeEditar} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>UF</Label>
                    <Input name="uf" maxLength={2} defaultValue={clinica.uf ?? ""} placeholder="SP" disabled={!podeEditar} />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-5 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Marca &amp; Marketplace</h3>
                <input type="hidden" name="exibir_marketplace" value={exibirMkt ? "1" : "0"} />
                <div className="space-y-1.5">
                  <Label>Sobre a clínica</Label>
                  <Input name="sobre" defaultValue={clinica.sobre ?? ""} placeholder="Uma frase que descreve a clínica" disabled={!podeEditar} />
                </div>
                <div className="space-y-1.5">
                  <Label>Endereço público (slug)</Label>
                  <Input name="slug" defaultValue={clinica.slug ?? ""} placeholder="minha-clinica" disabled={!podeEditar} />
                  <p className="text-xs text-muted-foreground">A clínica fica em /clinica/&lt;slug&gt; no marketplace.</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Aparecer no marketplace</p>
                    <p className="text-xs text-muted-foreground">Exibe a clínica na busca pública.</p>
                  </div>
                  <Switch checked={exibirMkt} disabled={!podeEditar} onCheckedChange={setExibirMkt} />
                </div>
              </div>

              {estadoDados.erro && (
                <p className="text-sm text-destructive">{estadoDados.erro}</p>
              )}
              {podeEditar && <BotaoSalvar salvo={Boolean(estadoDados.ok)} />}
            </form>
          )}

          {tab === "clinica" && podeEditar && (
            <div className="max-w-lg mt-6 border-t border-border pt-5 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Logo</h3>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted flex items-center justify-center text-muted-foreground">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="logo" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs">sem logo</span>
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    startLogo(async () => {
                      const r = await uploadLogoClinica(fd);
                      setLogoMsg(r.erro ?? "Logo atualizado.");
                    });
                  }}
                  className="flex items-center gap-2"
                >
                  <input type="file" name="logo" accept="image/*" className="text-sm" />
                  <Button type="submit" variant="outline" size="sm" disabled={enviandoLogo}>
                    {enviandoLogo ? "Enviando..." : "Enviar logo"}
                  </Button>
                </form>
              </div>
              {logoMsg && <p className="text-sm text-muted-foreground">{logoMsg}</p>}
            </div>
          )}

          {tab === "especialidades" && (
            <div className="space-y-6 max-w-lg">
              <div>
                <h2 className="text-base font-semibold">
                  Especialidades da Clínica
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione as especialidades oferecidas — elas aparecem na
                  busca do marketplace e nos cadastros de profissionais e
                  serviços.
                </p>
              </div>

              {segmentos.map((seg) => {
                const doSegmento = especialidades.filter(
                  (e) => e.segmento_id === seg.id
                );
                if (doSegmento.length === 0) return null;
                return (
                  <div key={seg.id} className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {seg.nome}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {doSegmento.map((esp) => {
                        const marcada = selecionadas.has(esp.id);
                        return (
                          <button
                            key={esp.id}
                            type="button"
                            disabled={!podeEditarEspecialidades}
                            onClick={() =>
                              setSelecionadas((prev) => {
                                const next = new Set(prev);
                                if (next.has(esp.id)) next.delete(esp.id);
                                else next.add(esp.id);
                                return next;
                              })
                            }
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-all disabled:opacity-60 ${
                              marcada
                                ? "border-primary bg-primary/5 text-foreground"
                                : "border-border text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                marcada
                                  ? "bg-primary border-primary text-white"
                                  : "border-muted-foreground"
                              }`}
                            >
                              {marcada && (
                                <svg viewBox="0 0 8 8" className="w-2.5 h-2.5 fill-current">
                                  <path d="M6.564.75l-3.59 3.612-1.538-1.55L0 4.26l2.974 2.99L8 2.193z" />
                                </svg>
                              )}
                            </span>
                            {esp.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {erroConfig && <p className="text-sm text-destructive">{erroConfig}</p>}
              {podeEditarEspecialidades && (
                <Button
                  disabled={pendente}
                  onClick={() =>
                    startTransition(async () => {
                      const resultado = await salvarEspecialidadesClinica(
                        Array.from(selecionadas)
                      );
                      setErroConfig(resultado.erro);
                      if (!resultado.erro) {
                        setSalvo(true);
                        setTimeout(() => setSalvo(false), 2000);
                      }
                    })
                  }
                >
                  {pendente ? "Salvando..." : salvo ? "✓ Salvo!" : "Salvar Especialidades"}
                </Button>
              )}
            </div>
          )}

          {tab === "financeiro" && (
            <div className="space-y-6 max-w-lg">
              <h2 className="text-base font-semibold">Regras Financeiras</h2>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Base de Cálculo de Comissões</h3>
                <p className="text-sm text-muted-foreground">
                  Define como os atendimentos são contabilizados no fechamento
                  de comissão dos profissionais.
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: "por_agendamento" as const, label: "Por Agendamento Concluído", desc: 'Conta cada consulta/agendamento com status "Concluído" na Agenda.' },
                    { id: "por_evolucao" as const, label: "Por Evolução Clínica", desc: "Conta cada evolução clínica registrada no Prontuário do paciente." },
                  ].map((op) => {
                    const sel = baseComissao === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        disabled={!podeEditar}
                        onClick={() => setBaseComissao(op.id)}
                        className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all disabled:opacity-60 ${
                          sel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                            sel ? "border-primary" : "border-muted-foreground"
                          }`}
                        >
                          {sel && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{op.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{op.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {erroConfig && <p className="text-sm text-destructive">{erroConfig}</p>}
              {podeEditar && (
                <Button onClick={() => salvarConfig({ base_comissao: baseComissao })} disabled={pendente}>
                  {rotuloBotao}
                </Button>
              )}
            </div>
          )}

          {tab === "notificacoes" && (
            <div className="space-y-6 max-w-lg">
              <div>
                <h2 className="text-base font-semibold">Lembretes Automáticos</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure quando os pacientes receberão lembretes antes do agendamento.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Antecedência</h3>
                {[
                  { key: "h24" as const, label: "24 horas antes", desc: "Lembrete enviado um dia antes da consulta" },
                  { key: "h12" as const, label: "12 horas antes", desc: "Lembrete enviado meio dia antes da consulta" },
                  { key: "h2" as const, label: "2 horas antes", desc: "Lembrete enviado 2 horas antes da consulta" },
                ].map((op) => (
                  <div key={op.key} className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">{op.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{op.desc}</p>
                    </div>
                    <Switch
                      checked={lembretes[op.key]}
                      disabled={!podeEditar}
                      onCheckedChange={(v) => setLembretes((f) => ({ ...f, [op.key]: v }))}
                    />
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-5 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Canal de Envio</h3>
                {[
                  { key: "whatsapp" as const, label: "WhatsApp", desc: "Envia mensagem via WhatsApp para o número do paciente" },
                  { key: "sms" as const, label: "SMS", desc: "Envia SMS para o telefone cadastrado do paciente" },
                  { key: "email" as const, label: "E-mail", desc: "Envia e-mail para o endereço cadastrado do paciente" },
                ].map((op) => (
                  <div key={op.key} className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">{op.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{op.desc}</p>
                    </div>
                    <Switch
                      checked={canais[op.key]}
                      disabled={!podeEditar}
                      onCheckedChange={(v) => setCanais((f) => ({ ...f, [op.key]: v }))}
                    />
                  </div>
                ))}
              </div>

              {erroConfig && <p className="text-sm text-destructive">{erroConfig}</p>}
              {podeEditar && (
                <Button onClick={() => salvarConfig({ lembretes, canais })} disabled={pendente}>
                  {rotuloBotao}
                </Button>
              )}
            </div>
          )}

          {tab === "origens" && (
            <div className="space-y-6 max-w-lg">
              <div>
                <h2 className="text-base font-semibold">Origens de Pacientes</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure de onde seus pacientes chegam. A origem aparece como
                  tag colorida no perfil do paciente.
                </p>
              </div>

              <div className="space-y-2">
                {origens.map((o, i) => (
                  <div key={`${o.nome}-${i}`} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${o.cor}`}>{o.nome}</span>
                    <span className="flex-1 text-sm text-muted-foreground">{o.nome}</span>
                    {podeEditar && (
                      <button
                        onClick={() => setOrigens((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {podeEditar && (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nova origem (ex: TikTok, Evento...)"
                      value={novaOrigem}
                      onChange={(e) => setNovaOrigem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          adicionarOrigem();
                        }
                      }}
                    />
                    <Button variant="outline" onClick={adicionarOrigem}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {erroConfig && <p className="text-sm text-destructive">{erroConfig}</p>}
                  <Button onClick={() => salvarConfig({ origens_pacientes: origens })} disabled={pendente}>
                    {pendente ? "Salvando..." : salvo ? "✓ Salvo!" : "Salvar Origens"}
                  </Button>
                </>
              )}
            </div>
          )}

          {tab === "horarios" && (
            <div className="space-y-6 max-w-lg">
              <div>
                <h2 className="text-base font-semibold">Horário de funcionamento</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Aparece na página pública da clínica. Dias fechados não são exibidos.
                </p>
              </div>

              <div className="space-y-2">
                {horas.map((h, dia) => (
                  <div
                    key={dia}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20"
                  >
                    <div className="flex items-center gap-2 w-40">
                      <Switch
                        checked={h.aberto}
                        onCheckedChange={(v) => setDia(dia, { aberto: v })}
                        disabled={!podeEditarEspecialidades}
                      />
                      <span className="text-sm font-medium">{DIAS_SEMANA[dia]}</span>
                    </div>
                    {h.aberto ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="time"
                          value={h.abertura}
                          onChange={(e) => setDia(dia, { abertura: e.target.value })}
                          disabled={!podeEditarEspecialidades}
                          className="w-28"
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          type="time"
                          value={h.fechamento}
                          onChange={(e) => setDia(dia, { fechamento: e.target.value })}
                          disabled={!podeEditarEspecialidades}
                          className="w-28"
                        />
                      </div>
                    ) : (
                      <span className="flex-1 text-sm text-muted-foreground">Fechado</span>
                    )}
                  </div>
                ))}
              </div>

              {podeEditarEspecialidades && (
                <>
                  {erroHorario && <p className="text-sm text-destructive">{erroHorario}</p>}
                  <Button onClick={salvarHorariosClick} disabled={pendenteHorario}>
                    {pendenteHorario ? "Salvando..." : salvoHorario ? "✓ Salvo!" : "Salvar Horários"}
                  </Button>
                </>
              )}
            </div>
          )}

          {tab === "permissoes" && (
            <div className="space-y-5 max-w-lg">
              <h2 className="text-base font-semibold">Papéis e Permissões</h2>
              <p className="text-sm text-muted-foreground">
                Os papéis disponíveis no sistema com suas permissões específicas:
              </p>
              <div className="space-y-3">
                {PAPEIS.map((r) => (
                  <div key={r.papel} className="p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">
                        {r.papel}
                      </span>
                      <span className="text-sm font-semibold">{r.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground border-t border-border pt-4">
                Para convidar usuários e gerenciar limites, acesse{" "}
                <strong>Usuários</strong> no menu lateral.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
