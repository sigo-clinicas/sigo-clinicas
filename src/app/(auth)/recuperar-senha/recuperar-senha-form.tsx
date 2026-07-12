"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { recuperarSenha, type EstadoAuth } from "@/lib/actions/auth";
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

function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Enviando..." : "Enviar link de recuperação"}
    </Button>
  );
}

export function RecuperarSenhaForm() {
  const [estado, dispatch] = useFormState(recuperarSenha, estadoInicial);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-primary">Recuperar senha</CardTitle>
        <CardDescription>
          Enviaremos um link de redefinição para o seu e-mail
        </CardDescription>
      </CardHeader>
      <CardContent>
        {estado.ok ? (
          <p className="rounded-md bg-secondary p-3 text-sm text-secondary-foreground">
            Se o e-mail estiver cadastrado, você receberá o link de
            redefinição em instantes.
          </p>
        ) : (
          <form action={dispatch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            {estado.erro && (
              <p className="text-sm text-destructive">{estado.erro}</p>
            )}
            <BotaoEnviar />
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            Voltar ao login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
