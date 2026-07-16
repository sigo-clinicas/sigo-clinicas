import { redirect } from "next/navigation";

import { PublicShell } from "@/components/publico/public-shell";
import { getSessaoComClaims } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Já logado → direto ao painel (LÓGICA intacta)
  const sessao = await getSessaoComClaims();
  if (sessao) redirect("/painel");

  // Reskin: as telas de auth vivem dentro do shell público (Sticky + Footer),
  // como no sistema antigo (Sticky inside={true} + Footer). Cada form traz o
  // próprio Hero centralizado.
  return <PublicShell inside>{children}</PublicShell>;
}
