"use client";

// S3-8 — Porta de reference/base44 PortalAgendamento.jsx (escopado à clínica).
// Picker de profissional (navega por ?prof=), slots livres e formulário de
// contato → POST /api/publico/agendamento (service_role no servidor).
// S1 — cruzamento serviço↔profissional nos dois sentidos, em memória, a partir
// da adjacência `vinculos` (profissional_servico público).
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  profissionaisParaServicos,
  servicosParaProfissional,
  type Vinculo,
} from "@/lib/cruzamento";

type Opcao = { id: string; nome: string };

export function AgendarClient({
  clinicaId,
  clinicaNome,
  slug,
  profissionais,
  servicos,
  vinculos,
  profSelecionado,
  slots,
}: {
  clinicaId: string;
  clinicaNome: string;
  slug: string;
  profissionais: Opcao[];
  servicos: Opcao[];
  vinculos: Vinculo[];
  profSelecionado: string | null;
  slots: string[];
}) {
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", cpf: "", observacoes: "" });
  const [servicoIds, setServicoIds] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  // Cruzamento nos dois sentidos (lógica pura em @/lib/cruzamento):
  //  - serviço → profissional: quem faz TODOS os serviços marcados (AND);
  //  - profissional → serviço: os serviços do profissional selecionado.
  // Ausência de adjacência nunca esconde — degrada para "mostrar tudo".
  const profissionaisVisiveis = useMemo(
    () => profissionaisParaServicos(profissionais, vinculos, servicoIds),
    [profissionais, vinculos, servicoIds]
  );
  const servicosVisiveis = useMemo(
    () => servicosParaProfissional(servicos, vinculos, profSelecionado),
    [servicos, vinculos, profSelecionado]
  );

  // agrupa slots por dia
  const porDia = new Map<string, string[]>();
  for (const s of slots) {
    const dia = new Date(s).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
    porDia.set(dia, [...(porDia.get(dia) ?? []), s]);
  }

  async function agendar() {
    if (!slot) return;
    setErro(null);
    setEnviando(true);
    try {
      const resp = await fetch("/api/publico/agendamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinica_id: clinicaId,
          profissional_id: profSelecionado,
          data_hora: slot,
          servico_ids: servicoIds,
          ...form,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) setErro(json.erro ?? "Não foi possível agendar.");
      else setConfirmado(true);
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setEnviando(false);
    }
  }

  if (confirmado) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
        <h1 className="mt-4 text-2xl font-semibold">Solicitação enviada!</h1>
        <p className="text-muted-foreground mt-2">
          Em breve {clinicaNome} entrará em contato para confirmar seu horário.
        </p>
        <Button asChild className="mt-6">
          <Link href={`/clinica/${slug}`}>Voltar à clínica</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <Link href={`/clinica/${slug}`} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="h-4 w-4" /> {clinicaNome}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Agendar online</h1>

      {profissionais.length === 0 ? (
        <p className="text-muted-foreground mt-6">Esta clínica ainda não tem profissionais disponíveis.</p>
      ) : (
        <>
          {/* Profissional — filtrado pelos serviços marcados */}
          <section className="mt-6">
            <Label className="text-muted-foreground text-xs uppercase">Profissional</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {profissionaisVisiveis.map((p) => (
                <Link
                  key={p.id}
                  href={`/clinica/${slug}/agendar?prof=${p.id}`}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    p.id === profSelecionado
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {p.nome}
                </Link>
              ))}
              {servicoIds.length > 0 && profissionaisVisiveis.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Nenhum profissional faz todos os serviços selecionados.
                </p>
              )}
            </div>
          </section>

          {/* Serviços (opcional) — só os que o profissional selecionado faz */}
          {servicosVisiveis.length > 0 && (
            <section className="mt-6">
              <Label className="text-muted-foreground text-xs uppercase">Serviços (opcional)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {servicosVisiveis.map((s) => {
                  const sel = servicoIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setServicoIds((ids) =>
                          sel ? ids.filter((i) => i !== s.id) : [...ids, s.id]
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm ${
                        sel ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                      }`}
                    >
                      {s.nome}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Slots */}
          <section className="mt-6">
            <Label className="text-muted-foreground text-xs uppercase">Horário</Label>
            {slots.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">
                Sem horários livres nos próximos dias. Tente outro profissional.
              </p>
            ) : (
              <div className="mt-2 space-y-3">
                {[...porDia.entries()].slice(0, 10).map(([dia, lista]) => (
                  <div key={dia}>
                    <p className="text-muted-foreground text-xs capitalize">{dia}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {lista.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSlot(s)}
                          className={`rounded-md border px-2.5 py-1 text-sm ${
                            slot === s
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Formulário */}
          {slot && (
            <section className="mt-8 space-y-3 rounded-xl border border-border p-4">
              <h2 className="font-medium">Seus dados</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nome*</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone*</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF</Label>
                  <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
              {erro && <p className="text-destructive text-sm">{erro}</p>}
              <Button
                onClick={agendar}
                disabled={enviando || !form.nome.trim() || !form.telefone.trim()}
                className="w-full"
              >
                {enviando ? "Enviando..." : "Confirmar agendamento"}
              </Button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
