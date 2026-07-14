import { redirect } from "next/navigation";

import { getSessaoComClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TERMINOLOGIA, temaDaClinica, type TipoClinica } from "@/lib/terminologia";
import { urlLogoPublica } from "@/lib/tipo-clinica";
import { PainelShell } from "@/components/painel/painel-shell";
import { TermoProvider } from "@/components/painel/terminologia-provider";
import { SemVinculo } from "@/components/painel/sem-vinculo";

// Guarda do painel (equivale ao ProtectedRoute.jsx do Base44, agora no
// servidor): sem sessão → login; sem vínculo com clínica → SemVinculo.
// O tipo da clínica ativa define tema (data-clinica-theme) e terminologia.
export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await getSessaoComClaims();
  if (!sessao) redirect("/login");

  if (!sessao.clinicaAtual || !sessao.papel) {
    return <SemVinculo />;
  }

  const supabase = createClient();
  const idsClinicas = Object.keys(sessao.clinicas);
  const [{ data: clinica }, { data: clinicasDoUsuario }] = await Promise.all([
    supabase
      .from("clinica")
      .select("nome,tipo,logo_path")
      .eq("id", sessao.clinicaAtual)
      .single(),
    supabase.from("clinica").select("id,nome").in("id", idsClinicas),
  ]);

  const tipo = (clinica?.tipo ?? "medica") as TipoClinica;
  const termo = TERMINOLOGIA[tipo];
  const logoUrl = urlLogoPublica(clinica?.logo_path ?? null);
  const nomeUsuario =
    (sessao.user.user_metadata?.nome as string | undefined) ??
    sessao.user.email ??
    "Usuário";

  return (
    <div data-clinica-theme={temaDaClinica(tipo)} className="contents">
      <TermoProvider termo={termo}>
        <PainelShell
          nomeClinica={clinica?.nome ?? "Sigo Clínicas"}
          tipoClinicaLabel={termo.tipoClinica}
          tipo={tipo}
          logoUrl={logoUrl}
          nomeUsuario={nomeUsuario}
          papel={sessao.papel}
          termo={termo}
          clinicasDoUsuario={clinicasDoUsuario ?? []}
          clinicaAtualId={sessao.clinicaAtual}
        >
          {children}
        </PainelShell>
      </TermoProvider>
    </div>
  );
}
