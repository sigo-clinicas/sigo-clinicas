// S4-3 — Tipos da segmentação de campanha (espelham a estrutura do jsonb
// campanha.filtros / campanha.conteudo). O disparo real é F2.

export type FiltrosCampanha = {
  demograficos?: {
    idade_minima?: number | null;
    idade_maxima?: number | null;
    generos?: string[]; // masculino | feminino | outro (enum sexo)
    localizacoes?: string[]; // cidades
  };
  temporais?: {
    data_cadastro_inicio?: string | null;
    data_cadastro_fim?: string | null;
    aniversario_mes?: number | null;
  };
  status_paciente?: { sem_visita_dias?: number | null };
  compra?: { sem_compra?: boolean };
};

export type ConteudoCampanha = {
  email?: { assunto?: string; corpo?: string };
  sms?: { mensagem?: string };
  whatsapp?: { mensagem?: string };
};

export const CANAIS = ["email", "sms", "whatsapp"] as const;
export type Canal = (typeof CANAIS)[number];
