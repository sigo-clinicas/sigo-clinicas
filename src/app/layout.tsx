import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sigo Clínicas",
  description:
    "Gestão para clínicas e marketplace de agendamento — médica, estética, odontológica e terapias.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
