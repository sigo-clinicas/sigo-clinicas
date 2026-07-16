"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { recuperarSenha, type EstadoAuth } from "@/lib/actions/auth";
import styles from "@/components/publico/auth.module.css";

const estadoInicial: EstadoAuth = { erro: null };

// Reskin visual: mesmo Hero/form do login antigo (o ForgotPasswordComponent
// antigo usava exatamente o mesmo styled). Lógica intacta (server action
// recuperarSenha via Supabase).

function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-green" disabled={pending}>
      <span>{pending ? "Enviando..." : "Enviar link de recuperação"}</span>
    </button>
  );
}

export function RecuperarSenhaForm() {
  const [estado, dispatch] = useFormState(recuperarSenha, estadoInicial);

  return (
    <header className={styles.hero}>
      <form action={dispatch} className="login-form">
        {estado.ok ? (
          <p className="aviso">
            Se o e-mail estiver cadastrado, você receberá o link de redefinição em
            instantes.
          </p>
        ) : (
          <>
            <div className="ant-form-item">
              <input
                className="ant-input"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Email"
                required
              />
            </div>

            {estado.erro && <p className="erro">{estado.erro}</p>}

            <div className="form-actions">
              <BotaoEnviar />
            </div>
          </>
        )}

        <div className="mb-2">
          <Link href="/login" className="utils__link">
            Voltar ao login
          </Link>
        </div>
      </form>
    </header>
  );
}
