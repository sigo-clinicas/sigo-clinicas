import type { Metadata } from "next";

// Área pública (sem sessão). A anamnese por token traz dado de paciente →
// noindex para não ser indexada por buscadores.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PublicoLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900 py-8 px-4">
      {children}
    </main>
  );
}
