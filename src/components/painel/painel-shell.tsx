"use client";

// Porta de reference/base44 src/components/Layout.jsx (sidebar + topbar).
// Diferenças do porte: react-router → next/navigation; roles do Base44
// (admin|gestor|recepcionista|profissional|user) → papéis reais do RBAC;
// item "Cobranças" NÃO portado (decisão M5/A6); logout via Server Action;
// rotas do painel sob /painel.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  CreditCard,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
  Receipt,
  Package,
  BookOpenCheck,
  ClipboardList,
  Megaphone,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { logout } from "@/lib/actions/auth";
import { definirClinicaAtual } from "@/lib/actions/usuarios";
import type { Papel } from "@/lib/auth";
import type { Terminologia, TipoClinica } from "@/lib/terminologia";

type NavChild = { label: string; path: string };
type NavItemDef = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  papeis: Papel[];
  children?: NavChild[];
};

const TODOS: Papel[] = [
  "proprietario",
  "gerente",
  "recepcionista",
  "assistente",
  "profissional",
];
const GESTAO: Papel[] = ["proprietario", "gerente"];
const RECEPCAO: Papel[] = [
  "proprietario",
  "gerente",
  "recepcionista",
  "assistente",
];

function buildNavItems(termo: Terminologia): NavItemDef[] {
  return [
    { label: "Dashboard", icon: LayoutDashboard, path: "/painel", papeis: TODOS },
    { label: "Agenda", icon: Calendar, path: "/painel/agenda", papeis: TODOS },
    { label: termo.pacientes, icon: Users, path: "/painel/pacientes", papeis: RECEPCAO },
    {
      label: "Prontuários",
      icon: BookOpenCheck,
      path: "/painel/prontuarios",
      papeis: ["proprietario", "gerente", "profissional"],
    },
    {
      label: `${termo.orcamento}s`,
      icon: Receipt,
      path: "/painel/orcamentos",
      papeis: RECEPCAO,
    },
    { label: "Anamnese", icon: ClipboardList, path: "/painel/anamnese", papeis: RECEPCAO },
    { label: "Estoque", icon: Package, path: "/painel/estoque", papeis: GESTAO },
    {
      label: "Financeiro",
      icon: CreditCard,
      papeis: GESTAO,
      children: [
        { label: "Fluxo de Caixa", path: "/painel/financeiro/fluxo-caixa" },
        { label: "Contas", path: "/painel/financeiro/contas" },
        // "Cobranças" removida do escopo (M5) — não portar
        { label: "Convênios", path: "/painel/financeiro/convenios" },
        { label: "Comissões", path: "/painel/financeiro/comissoes" },
      ],
    },
    { label: "Relatórios", icon: FileText, path: "/painel/relatorios", papeis: GESTAO },
    {
      label: "Marketing",
      icon: Megaphone,
      papeis: GESTAO,
      children: [
        { label: "Cupons", path: "/painel/marketing/cupons" },
        { label: "Campanhas", path: "/painel/marketing/campanhas" },
        { label: "Sala VIP", path: "/painel/marketing/sala-vip" },
        { label: "Depoimentos", path: "/painel/marketing/depoimentos" },
        { label: "Landing Page", path: "/" },
      ],
    },
    {
      label: "Configurações",
      icon: Settings,
      papeis: GESTAO,
      children: [
        { label: "Geral", path: "/painel/configuracoes" },
        { label: termo.profissionais, path: "/painel/profissionais" },
        { label: "Serviços e Preços", path: "/painel/servicos" },
        { label: "Anamnese", path: "/painel/anamnese" },
      ],
    },
    { label: "Usuários", icon: Users, path: "/painel/usuarios", papeis: GESTAO },
  ];
}

function NavItem({ item, collapsed }: { item: NavItemDef; collapsed: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = item.path
    ? pathname === item.path
    : item.children?.some((c) => pathname === c.path);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          )}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {open ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </>
          )}
        </button>
        {!collapsed && open && (
          <div className="ml-7 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
            {item.children.map((child) => (
              <Link
                key={child.path}
                href={child.path}
                className={cn(
                  "block px-2 py-2 rounded text-xs font-medium transition-all",
                  pathname === child.path
                    ? "text-white bg-sidebar-accent"
                    : "text-sidebar-foreground/70 hover:text-white"
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.path!}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

const PAPEL_LABEL: Record<Papel, string> = {
  proprietario: "Proprietário",
  gerente: "Gerente",
  recepcionista: "Recepcionista",
  assistente: "Assistente",
  profissional: "Profissional",
};

export function PainelShell({
  nomeClinica,
  tipoClinicaLabel,
  logoUrl,
  nomeUsuario,
  papel,
  termo,
  clinicasDoUsuario,
  clinicaAtualId,
  children,
}: {
  nomeClinica: string;
  tipoClinicaLabel: string;
  tipo: TipoClinica;
  logoUrl: string | null;
  nomeUsuario: string;
  papel: Papel;
  termo: Terminologia;
  clinicasDoUsuario: { id: string; nome: string }[];
  clinicaAtualId: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = buildNavItems(termo).filter((item) =>
    item.papeis.includes(papel)
  );
  const inicial = nomeUsuario?.[0]?.toUpperCase() || "U";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:relative z-50 h-full flex flex-col bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
          <div
            className={cn(
              "shrink-0 overflow-hidden rounded-full bg-white/15 flex items-center justify-center text-white font-bold transition-all",
              collapsed ? "h-8 w-8 text-sm" : "h-11 w-11 text-lg"
            )}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={nomeClinica} className="h-full w-full object-cover" />
            ) : (
              // Clínica sem logo própria → marca SigoClínicas (fallback do produto)
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/static/logo_icon.png"
                alt="Sigo Clínicas"
                className="h-full w-full object-contain p-1.5"
              />
            )}
          </div>
          {!collapsed && (
            <div>
              <div className="text-white font-semibold text-sm">
                {nomeClinica || "Sigo Clínicas"}
              </div>
              <div className="text-sidebar-foreground/60 text-xs">
                {tipoClinicaLabel}
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleItems.map((item) => (
            <NavItem key={item.label} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {inicial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">
                  {nomeUsuario}
                </div>
                <div className="text-sidebar-foreground/60 text-xs">
                  {PAPEL_LABEL[papel]}
                </div>
              </div>
            </div>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50 text-sm transition-all"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </button>
          </form>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border items-center justify-center text-sidebar-foreground hover:text-white transition-all"
        >
          <ChevronRight
            className={cn("w-3 h-3 transition-transform", collapsed ? "" : "rotate-180")}
          />
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center gap-4 px-6 shrink-0">
          <button
            className="lg:hidden text-muted-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1" />
          {clinicasDoUsuario.length > 1 && (
            <form action={definirClinicaAtual}>
              <select
                name="clinica_id"
                defaultValue={clinicaAtualId}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                aria-label="Trocar clínica"
              >
                {clinicasDoUsuario.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </form>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
              {inicial}
            </div>
            <div className="hidden md:block text-right">
              <div className="text-sm font-medium text-foreground">
                {nomeUsuario}
              </div>
              <div className="text-xs text-muted-foreground">
                {PAPEL_LABEL[papel]}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
