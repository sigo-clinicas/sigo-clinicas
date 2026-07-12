"use client";

// Miniatura de foto de bucket PRIVADO: resolve a signed URL no servidor (A8).
// next/image não cabe — URL temporária de host dinâmico.
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { urlAssinada } from "@/lib/storage";

export function FotoThumb({
  path,
  bucket = "prontuario",
  className = "w-20 h-20 object-cover rounded-lg border border-border",
  onClick,
}: {
  path: string;
  bucket?: "prontuario" | "documentos";
  className?: string;
  onClick?: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    urlAssinada(bucket, path).then((u) => {
      if (vivo) setUrl(u);
    });
    return () => {
      vivo = false;
    };
  }, [path, bucket]);

  if (!url) {
    return (
      <div className="w-20 h-20 rounded-lg border border-border bg-muted flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL de bucket privado; next/image não cabe (URL temporária, host dinâmico)
    <img
      src={url}
      alt="Foto do prontuário"
      className={className}
      onClick={onClick ? () => onClick(url) : undefined}
    />
  );
}
