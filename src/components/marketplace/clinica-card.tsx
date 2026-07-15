import Link from "next/link";
import { MapPin } from "@/components/lucide-icons";

import type { ClinicaPublica } from "@/lib/marketplace";
import { urlLogoPublica } from "@/lib/tipo-clinica";

export const TIPO_CLINICA_LABEL: Record<string, string> = {
  medica: "Clínica Médica",
  estetica: "Clínica Estética",
  odontologica: "Clínica Odontológica",
  terapias: "Terapias e Bem-Estar",
};

// Logo real (Storage) fica como follow-up (bucket público/URL assinada);
// por ora, avatar com a inicial da clínica.
export function ClinicaCard({ clinica }: { clinica: ClinicaPublica }) {
  const inicial = clinica.nome.charAt(0).toUpperCase();
  const local = [clinica.cidade, clinica.uf].filter(Boolean).join(" · ");
  const logo = urlLogoPublica(clinica.logo_path);
  return (
    <Link
      href={clinica.slug ? `/clinica/${clinica.slug}` : "#"}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-semibold">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={clinica.nome} className="h-full w-full object-cover" />
          ) : (
            inicial
          )}
        </span>
        <div className="min-w-0">
          <h3 className="group-hover:text-primary truncate font-semibold">{clinica.nome}</h3>
          <p className="text-muted-foreground truncate text-xs">
            {clinica.tipo ? TIPO_CLINICA_LABEL[clinica.tipo] ?? clinica.tipo : ""}
          </p>
        </div>
      </div>
      {local && (
        <p className="text-muted-foreground mt-3 flex items-center gap-1 text-sm">
          <MapPin className="h-3.5 w-3.5" /> {local}
        </p>
      )}
      {clinica.sobre && (
        <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{clinica.sobre}</p>
      )}
      <span className="text-primary mt-4 text-sm font-medium">Ver clínica →</span>
    </Link>
  );
}
