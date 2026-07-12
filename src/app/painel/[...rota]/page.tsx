import { Construction } from "lucide-react";

// Catch-all das rotas do painel ainda não portadas — deixa o menu completo
// navegável na homologação sem fingir que a tela existe.
export default function EmConstrucao({
  params,
}: {
  params: { rota: string[] };
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-6">
      <Construction className="w-12 h-12 text-muted-foreground mb-4" />
      <h1 className="text-xl font-semibold text-foreground">
        Em construção
      </h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        A tela <span className="font-mono">/{params.rota.join("/")}</span> será
        portada do protótipo Base44 no sprint correspondente do roadmap.
      </p>
    </div>
  );
}
