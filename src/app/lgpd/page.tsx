import type { Metadata } from "next";

import { PaginaLegal } from "@/components/publico/pagina-legal";
import { ConteudoLgpd } from "@/components/publico/legais/lgpd";

export const metadata: Metadata = {
  title: "SigoClínicas - Termos de Consentimento - LGPD",
};

export default function LgpdPage() {
  return (
    <PaginaLegal>
      <ConteudoLgpd />
    </PaginaLegal>
  );
}
