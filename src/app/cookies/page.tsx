import type { Metadata } from "next";

import { PaginaLegal } from "@/components/publico/pagina-legal";
import { ConteudoCookies } from "@/components/publico/legais/cookies";

export const metadata: Metadata = { title: "SigoClínicas - Política de cookies" };

export default function CookiesPage() {
  return (
    <PaginaLegal>
      <ConteudoCookies />
    </PaginaLegal>
  );
}
