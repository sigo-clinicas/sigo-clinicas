// Porta de reference/base44 src/lib/ClinicaContext.jsx (TERMINOLOGIA) —
// white-label M7: o tipo da clínica dirige a nomenclatura em toda a UI.
// No produto novo o tipo vem de public.clinica.tipo (enum tipo_clinica);
// aqui só a tabela de termos (módulo puro, usável em Server e Client).

import type { Database } from "@/lib/database.types";

export type TipoClinica = Database["public"]["Enums"]["tipo_clinica"];

export type Terminologia = {
  paciente: string;
  pacientes: string;
  atendimento: string;
  atendimentos: string;
  profissional: string;
  profissionais: string;
  agendamento: string;
  prontuario: string;
  orcamento: string;
  tipoClinica: string;
};

export const TERMINOLOGIA: Record<TipoClinica, Terminologia> = {
  medica: {
    paciente: "Paciente",
    pacientes: "Pacientes",
    atendimento: "Consulta",
    atendimentos: "Consultas",
    profissional: "Profissional",
    profissionais: "Profissionais",
    agendamento: "Consulta",
    prontuario: "Prontuário",
    orcamento: "Orçamento",
    tipoClinica: "Clínica Médica",
  },
  estetica: {
    paciente: "Cliente",
    pacientes: "Clientes",
    atendimento: "Atendimento",
    atendimentos: "Atendimentos",
    profissional: "Profissional",
    profissionais: "Profissionais",
    agendamento: "Agendamento",
    prontuario: "Ficha do Cliente",
    orcamento: "Orçamento",
    tipoClinica: "Clínica Estética",
  },
  odontologica: {
    paciente: "Paciente",
    pacientes: "Pacientes",
    atendimento: "Atendimento",
    atendimentos: "Atendimentos",
    profissional: "Dentista",
    profissionais: "Dentistas",
    agendamento: "Consulta",
    prontuario: "Prontuário",
    orcamento: "Plano de Tratamento",
    tipoClinica: "Clínica Odontológica",
  },
  terapias: {
    paciente: "Cliente",
    pacientes: "Clientes",
    atendimento: "Sessão",
    atendimentos: "Sessões",
    profissional: "Terapeuta",
    profissionais: "Terapeutas",
    agendamento: "Agendamento",
    prontuario: "Ficha do Cliente",
    orcamento: "Orçamento",
    tipoClinica: "Terapias e Bem-Estar",
  },
};

/** data-clinica-theme usado pelo CSS (odontologica → "odontologia" no tema). */
export function temaDaClinica(tipo: TipoClinica): string {
  return tipo === "odontologica" ? "odontologia" : tipo;
}
