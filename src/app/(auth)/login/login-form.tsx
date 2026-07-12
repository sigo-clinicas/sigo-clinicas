"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { login, type EstadoAuth } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const estadoInicial: EstadoAuth = { erro: null };

function BotaoEntrar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

export function LoginForm({ senhaRedefinida }: { senhaRedefinida: boolean }) {
  const [estado, dispatch] = useFormState(login, estadoInicial);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-primary">Sigo Clínicas</CardTitle>
        <CardDescription>Acesse o painel da sua clínica</CardDescription>
      </CardHeader>
      <CardContent>
        {senhaRedefinida && (
          <p className="mb-4 rounded-md bg-secondary p-3 text-sm text-secondary-foreground">
            Senha redefinida com sucesso. Entre com a nova senha.
          </p>
        )}
        <form action={dispatch} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@clinica.com.br"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {estado.erro && (
            <p className="text-sm text-destructive">{estado.erro}</p>
          )}
          <BotaoEntrar />
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/recuperar-senha"
              className="text-primary underline-offset-4 hover:underline"
            >
              Esqueci minha senha
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
