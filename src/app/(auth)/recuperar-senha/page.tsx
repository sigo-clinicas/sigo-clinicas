import type { Metadata } from "next";

import { RecuperarSenhaForm } from "./recuperar-senha-form";

export const metadata: Metadata = {
  title: "Recuperar senha — Sigo Clínicas",
};

export default function RecuperarSenhaPage() {
  return <RecuperarSenhaForm />;
}
