"use client";

// S4-5 — casca de abas: Cadastro (porta Base44) + Fechamento de guias (novo).
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ConveniosClient, type ConvenioLinha } from "./convenios-client";
import { FechamentoConvenios } from "./fechamento-convenios";

export function ConveniosTabs({
  convenios,
  contas,
  podeGerenciar,
}: {
  convenios: ConvenioLinha[];
  contas: { id: string; nome: string }[];
  podeGerenciar: boolean;
}) {
  return (
    <Tabs defaultValue="cadastro">
      <div className="border-b border-border px-6 pt-4">
        <TabsList>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="fechamento">Fechamento de guias</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="cadastro" className="mt-0">
        <ConveniosClient convenios={convenios} podeGerenciar={podeGerenciar} />
      </TabsContent>
      <TabsContent value="fechamento" className="mt-0">
        <FechamentoConvenios
          convenios={convenios.filter((c) => c.ativo)}
          contas={contas}
          podeGerenciar={podeGerenciar}
        />
      </TabsContent>
    </Tabs>
  );
}
