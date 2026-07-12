import Link from "next/link";

import { Button } from "@/components/ui/button";

// Raiz pública: recebe o marketplace multi-clínica no Sprint 3 (A7 — legado
// www como referência funcional, Base44 LandingPage como referência visual).
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">Sigo Clínicas</h1>
        <p className="mt-2 text-muted-foreground">
          O marketplace público entra no Sprint 3.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">Acessar o painel</Link>
        </Button>
      </div>
    </main>
  );
}
