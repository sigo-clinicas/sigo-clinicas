"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { login, type EstadoAuth } from "@/lib/actions/auth";
import { EmBreve } from "@/components/publico/em-breve";
import styles from "@/components/publico/auth.module.css";

const estadoInicial: EstadoAuth = { erro: null };

// Reskin visual: layout do LoginComponent antigo. A LÓGICA (Supabase Auth via a
// server action `login`, dispatch, names email/senha, estado.erro) permanece
// intacta — nenhuma chamada ao backend antigo (services/api.js, /oauth) voltou.

function BotaoLogin() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-green" disabled={pending}>
      <span>{pending ? "Entrando..." : "Login"}</span>
    </button>
  );
}

export function LoginForm({ senhaRedefinida }: { senhaRedefinida: boolean }) {
  const [estado, dispatch] = useFormState(login, estadoInicial);

  return (
    <header className={styles.hero}>
      <form action={dispatch} className="login-form">
        {senhaRedefinida && (
          <p className="aviso">Senha redefinida com sucesso. Entre com a nova senha.</p>
        )}

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
        <div className="ant-form-item">
          <input
            className="ant-input"
            name="senha"
            type="password"
            autoComplete="current-password"
            placeholder="Senha"
            required
          />
        </div>

        {estado.erro && <p className="erro">{estado.erro}</p>}

        <div className="form-actions">
          <BotaoLogin />
        </div>

        <div className="mb-2">
          <Link href="/" className="utils__link">
            Continuar sem login
          </Link>
        </div>
        <div className="mb-2">
          <span>Não tem uma conta? </span>
          {/* /cadastro (auto-cadastro de paciente) não existe no projeto novo —
              inerte com "Em breve", como decidido para o rodapé/header */}
          <EmBreve como="a" className="utils__link">
            Registre-se
          </EmBreve>
        </div>
        <div className="mb-2">
          <Link href="/recuperar-senha" className="utils__link">
            Esqueci minha senha!
          </Link>
        </div>
      </form>
    </header>
  );
}
