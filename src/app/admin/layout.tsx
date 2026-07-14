import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";

// Área da PLATAFORMA (admin global — claim admin_plataforma). Separada do
// painel da clínica: o admin pode não ter vínculo com clínica alguma.
// Recebe as demais telas admin (Leads, Planos, Sala VIP) no S4.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await getSessaoComClaims();
  if (!sessao) redirect("/login");
  if (!sessao.isAdmin) redirect("/painel");

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 bg-sidebar flex items-center gap-6 px-6">
        <span className="text-white font-semibold">
          Sigo Clínicas — Administração
        </span>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/admin/especialidades"
            className="text-sidebar-foreground hover:text-white transition-colors"
          >
            Especialidades
          </Link>
          <Link
            href="/admin/destaque"
            className="text-sidebar-foreground hover:text-white transition-colors"
          >
            Destaque
          </Link>
          <Link
            href="/admin/lgpd"
            className="text-sidebar-foreground hover:text-white transition-colors"
          >
            LGPD
          </Link>
        </nav>
        <div className="flex-1" />
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-sidebar-foreground hover:text-white transition-colors"
          >
            Sair
          </button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  );
}
