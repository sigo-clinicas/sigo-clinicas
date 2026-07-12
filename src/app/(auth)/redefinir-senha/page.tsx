import type { Metadata } from "next";

import { RedefinirSenhaForm } from "./redefinir-senha-form";

export const metadata: Metadata = {
  title: "Redefinir senha — Sigo Clínicas",
};

export default function RedefinirSenhaPage() {
  return <RedefinirSenhaForm />;
}
