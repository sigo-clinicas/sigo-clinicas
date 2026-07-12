"use client";

// Porta de reference/base44 src/pages/GerenciamentoUsuarios.jsx (client).
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Mail, Plus, Trash2 } from "lucide-react";

import type { Papel } from "@/lib/auth";
import {
  alterarPapel,
  convidarUsuario,
  removerUsuario,
  type EstadoUsuarios,
} from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type UsuarioLinha = {
  vinculoId: string;
  userId: string;
  papel: Papel;
  ativo: boolean;
  nome: string;
  email: string;
};

export type PlanoInfo = {
  nome: string;
  descricao: string | null;
  precoMensal: number;
  limites: Record<string, number>;
  proximaCobranca: string | null;
};

// Papéis do RBAC real (o Base44 listava admin/gestor/recepcionista/
// profissional; descrições adaptadas à matriz do legado)
const PAPEIS: { papel: Papel; label: string; desc: string }[] = [
  {
    papel: "proprietario",
    label: "Proprietário",
    desc: "Acesso total à clínica — configurações, usuários, financeiro, relatórios, pacientes e agenda.",
  },
  {
    papel: "gerente",
    label: "Gerente",
    desc: "Gestão completa exceto o cadastro da clínica. Financeiro, relatórios e equipe.",
  },
  {
    papel: "recepcionista",
    label: "Recepcionista",
    desc: "Agenda, cadastro de pacientes, orçamentos e vendas. Sem financeiro gerencial.",
  },
  {
    papel: "assistente",
    label: "Assistente",
    desc: "Apoio à recepção e ao atendimento: agenda, pacientes, orçamentos e vendas.",
  },
  {
    papel: "profissional",
    label: "Profissional de Saúde",
    desc: "Sua agenda, seus pacientes e prontuários. Sem acesso ao financeiro.",
  },
];

const COR_PAPEL: Record<Papel, string> = {
  proprietario: "bg-red-100 text-red-800",
  gerente: "bg-orange-100 text-orange-800",
  recepcionista: "bg-blue-100 text-blue-800",
  assistente: "bg-purple-100 text-purple-800",
  profissional: "bg-green-100 text-green-800",
};

const estadoInicial: EstadoUsuarios = { erro: null };

function BotaoEnviarConvite() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="flex-1" disabled={pending}>
      <Mail className="w-4 h-4 mr-2" />
      {pending ? "Enviando..." : "Enviar Convite"}
    </Button>
  );
}

export function UsuariosClient({
  usuarios,
  plano,
  papelAtor,
  isAdmin,
  meuUserId,
}: {
  usuarios: UsuarioLinha[];
  plano: PlanoInfo | null;
  papelAtor: Papel;
  isAdmin: boolean;
  meuUserId: string;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [papelSelecionado, setPapelSelecionado] = useState<Papel>("recepcionista");
  const [estadoConvite, dispatchConvite] = useFormState(
    convidarUsuario,
    estadoInicial
  );
  const [estadoPapel, dispatchPapel] = useFormState(alterarPapel, estadoInicial);
  const [estadoRemover, dispatchRemover] = useFormState(
    removerUsuario,
    estadoInicial
  );

  const podeConcederProprietario = papelAtor === "proprietario" || isAdmin;
  const papeisDisponiveis = PAPEIS.filter(
    (p) => p.papel !== "proprietario" || podeConcederProprietario
  );

  const labelPapel = (papel: Papel) =>
    PAPEIS.find((p) => p.papel === papel)?.label ?? papel;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Tabs defaultValue="usuarios" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="planos">Planos</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-foreground">
              Gerenciamento de Usuários
            </h1>
            <Button onClick={() => setModalAberto(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Convidar Usuário
            </Button>
          </div>

          {(estadoPapel.erro || estadoRemover.erro) && (
            <p className="mb-4 text-sm text-destructive">
              {estadoPapel.erro ?? estadoRemover.erro}
            </p>
          )}

          <div className="grid gap-4">
            {usuarios.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum usuário cadastrado.
                </CardContent>
              </Card>
            ) : (
              usuarios.map((usuario) => {
                const contagem = usuarios.filter(
                  (u) => u.papel === usuario.papel
                ).length;
                const limite = plano?.limites[usuario.papel];
                const souEu = usuario.userId === meuUserId;
                return (
                  <Card key={usuario.vinculoId}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {usuario.nome}
                            {souEu && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (você)
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {usuario.email}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={COR_PAPEL[usuario.papel]}>
                              {labelPapel(usuario.papel)}
                            </Badge>
                            {limite !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                ({contagem}/{limite})
                              </span>
                            )}
                          </div>
                        </div>
                        {!souEu && (
                          <div className="flex items-center gap-2">
                            <form action={dispatchPapel}>
                              <input
                                type="hidden"
                                name="vinculo_id"
                                value={usuario.vinculoId}
                              />
                              <input
                                type="hidden"
                                name="user_id"
                                value={usuario.userId}
                              />
                              <select
                                name="papel"
                                defaultValue={usuario.papel}
                                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                                onChange={(e) =>
                                  e.currentTarget.form?.requestSubmit()
                                }
                              >
                                {papeisDisponiveis.map((p) => (
                                  <option key={p.papel} value={p.papel}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                            </form>
                            <form action={dispatchRemover}>
                              <input
                                type="hidden"
                                name="vinculo_id"
                                value={usuario.vinculoId}
                              />
                              <input
                                type="hidden"
                                name="user_id"
                                value={usuario.userId}
                              />
                              <Button size="sm" variant="outline" type="submit">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </form>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="planos" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Limite de Usuários por Papel</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Definidos pelo plano de assinatura da clínica
            </p>
          </div>

          {!plano ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Nenhum plano ativo. A assinatura da clínica é configurada
                  pela administração da plataforma.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{plano.nome}</h3>
                      <p className="text-sm text-muted-foreground">
                        {plano.descricao}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        R$ {plano.precoMensal.toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground">/mês</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {PAPEIS.filter((p) => plano.limites[p.papel] !== undefined).map(
                  (papel) => {
                    const contagem = usuarios.filter(
                      (u) => u.papel === papel.papel
                    ).length;
                    const limite = plano.limites[papel.papel];
                    const porcentagem =
                      limite > 0 ? Math.round((contagem / limite) * 100) : 100;
                    return (
                      <Card key={papel.papel}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-semibold">{papel.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {contagem} de {limite} usuários
                              </p>
                            </div>
                            <Badge
                              variant={
                                porcentagem > 80 ? "destructive" : "secondary"
                              }
                            >
                              {porcentagem}%
                            </Badge>
                          </div>
                          <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                porcentagem > 80
                                  ? "bg-red-500"
                                  : porcentagem > 50
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min(porcentagem, 100)}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                )}
              </div>

              {plano.proximaCobranca && (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      Próxima cobrança:{" "}
                      <span className="font-semibold">
                        {plano.proximaCobranca}
                      </span>
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Convidar Novo Usuário</DialogTitle>
          </DialogHeader>
          <form action={dispatchConvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email *</label>
              <Input
                type="email"
                name="email"
                placeholder="usuario@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">
                Selecione o Papel *
              </label>
              <input type="hidden" name="papel" value={papelSelecionado} />
              <div className="space-y-2">
                {papeisDisponiveis.map((papel) => (
                  <button
                    type="button"
                    key={papel.papel}
                    onClick={() => setPapelSelecionado(papel.papel)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      papelSelecionado === papel.papel
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{papel.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {papel.desc}
                        </p>
                      </div>
                      {papelSelecionado === papel.papel && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {estadoConvite.erro && (
              <p className="text-sm text-destructive">{estadoConvite.erro}</p>
            )}
            {estadoConvite.ok && (
              <p className="text-sm text-success">Convite enviado!</p>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setModalAberto(false)}
              >
                Cancelar
              </Button>
              <BotaoEnviarConvite />
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
