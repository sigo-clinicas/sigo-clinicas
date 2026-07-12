import type { Metadata } from "next";

import { LoginForm } from "./login-form";

// Tela nova (o Base44 usava o login hospedado do BaaS — A8). Visual segue a
// linguagem do protótipo: card shadcn, primária do tema padrão.
export const metadata: Metadata = { title: "Entrar — Sigo Clínicas" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { senha_redefinida?: string };
}) {
  return <LoginForm senhaRedefinida={Boolean(searchParams.senha_redefinida)} />;
}
