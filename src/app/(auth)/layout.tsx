import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Já logado → direto ao painel
  const sessao = await getSessaoComClaims();
  if (sessao) redirect("/painel");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-50 p-4">
      {children}
    </main>
  );
}
