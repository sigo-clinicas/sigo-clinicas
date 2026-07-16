"use client";

import { useFormState, useFormStatus } from "react-dom";

import { redefinirSenha, type EstadoAuth } from "@/lib/actions/auth";
import styles from "@/components/publico/auth.module.css";

const estadoInicial: EstadoAuth = { erro: null };

// Reskin visual: mesmo Hero/form do login antigo (o CreatePasswordComponent
// antigo usava exatamente o mesmo styled). Lógica intacta (server action
// redefinirSenha via Supabase; names senha/confirmacao preservados).

function BotaoRedefinir() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-green" disabled={pending}>
      <span>{pending ? "Salvando..." : "Redefinir senha"}</span>
    </button>
  );
}

export function RedefinirSenhaForm() {
  const [estado, dispatch] = useFormState(redefinirSenha, estadoInicial);

  return (
    <header className={styles.hero}>
      <form action={dispatch} className="login-form">
        <div className="ant-form-item">
          <input
            className="ant-input"
            name="senha"
            type="password"
            autoComplete="new-password"
            minLength={8}
            placeholder="Nova senha"
            required
          />
        </div>
        <div className="ant-form-item">
          <input
            className="ant-input"
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            minLength={8}
            placeholder="Confirme a nova senha"
            required
          />
        </div>

        {estado.erro && <p className="erro">{estado.erro}</p>}

        <div className="form-actions">
          <BotaoRedefinir />
        </div>
      </form>
    </header>
  );
}
