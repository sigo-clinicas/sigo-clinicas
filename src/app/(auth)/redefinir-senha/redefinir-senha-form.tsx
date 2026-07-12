"use client";

import { useFormState, useFormStatus } from "react-dom";

import { redefinirSenha, type EstadoAuth } from "@/lib/actions/auth";
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

function BotaoRedefinir() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Salvando..." : "Redefinir senha"}
    </Button>
  );
}

export function RedefinirSenhaForm() {
  const [estado, dispatch] = useFormState(redefinirSenha, estadoInicial);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-primary">Nova senha</CardTitle>
        <CardDescription>Defina a sua nova senha de acesso</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={dispatch} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senha">Nova senha</Label>
            <Input
              id="senha"
              name="senha"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmacao">Confirme a nova senha</Label>
            <Input
              id="confirmacao"
              name="confirmacao"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {estado.erro && (
            <p className="text-sm text-destructive">{estado.erro}</p>
          )}
          <BotaoRedefinir />
        </form>
      </CardContent>
    </Card>
  );
}
