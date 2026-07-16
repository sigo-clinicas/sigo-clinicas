import type { Metadata } from "next";

import { PaginaLegal } from "@/components/publico/pagina-legal";
import { ConteudoPrivacidade } from "@/components/publico/legais/privacidade";

export const metadata: Metadata = { title: "SigoClínicas - Política de privacidade" };

export default function PrivacidadePage() {
  return (
    <PaginaLegal>
      <ConteudoPrivacidade />
    </PaginaLegal>
  );
}
