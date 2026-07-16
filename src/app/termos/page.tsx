import type { Metadata } from "next";

import { PaginaLegal } from "@/components/publico/pagina-legal";
import { ConteudoTermos } from "@/components/publico/legais/termos";

export const metadata: Metadata = { title: "SigoClínicas - Termos de uso" };

export default function TermosPage() {
  return (
    <PaginaLegal>
      <ConteudoTermos />
    </PaginaLegal>
  );
}
