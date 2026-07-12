export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_plataforma: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assinatura_clinica: {
        Row: {
          clinica_id: string
          created_at: string
          data_cancelamento: string | null
          data_inicio: string
          id: string
          notas: string | null
          plano_id: string
          preco_mensal: number | null
          proxima_cobranca: string | null
          status: Database["public"]["Enums"]["status_assinatura"]
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          data_cancelamento?: string | null
          data_inicio?: string
          id?: string
          notas?: string | null
          plano_id: string
          preco_mensal?: number | null
          proxima_cobranca?: string | null
          status?: Database["public"]["Enums"]["status_assinatura"]
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          data_cancelamento?: string | null
          data_inicio?: string
          id?: string
          notas?: string | null
          plano_id?: string
          preco_mensal?: number | null
          proxima_cobranca?: string | null
          status?: Database["public"]["Enums"]["status_assinatura"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinatura_clinica_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: true
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinatura_clinica_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plano_assinatura"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_clinica: {
        Row: {
          altura: number | null
          clinica_id: string
          created_at: string
          data: string
          exame_especifico: string | null
          fotos: Json
          frequencia_cardiaca: string | null
          hipotese_diagnostica: string | null
          historia_doenca_atual: string | null
          historico_familiar: string | null
          id: string
          paciente_id: string
          peso: number | null
          plano_terapeutico: string | null
          pressao_arterial: string | null
          profissional_id: string | null
          queixa_principal: string | null
          resultados_exames: string | null
          revisao_sistemas: string | null
          updated_at: string
        }
        Insert: {
          altura?: number | null
          clinica_id: string
          created_at?: string
          data?: string
          exame_especifico?: string | null
          fotos?: Json
          frequencia_cardiaca?: string | null
          hipotese_diagnostica?: string | null
          historia_doenca_atual?: string | null
          historico_familiar?: string | null
          id?: string
          paciente_id: string
          peso?: number | null
          plano_terapeutico?: string | null
          pressao_arterial?: string | null
          profissional_id?: string | null
          queixa_principal?: string | null
          resultados_exames?: string | null
          revisao_sistemas?: string | null
          updated_at?: string
        }
        Update: {
          altura?: number | null
          clinica_id?: string
          created_at?: string
          data?: string
          exame_especifico?: string | null
          fotos?: Json
          frequencia_cardiaca?: string | null
          hipotese_diagnostica?: string | null
          historia_doenca_atual?: string | null
          historico_familiar?: string | null
          id?: string
          paciente_id?: string
          peso?: number | null
          plano_terapeutico?: string | null
          pressao_arterial?: string | null
          profissional_id?: string | null
          queixa_principal?: string | null
          resultados_exames?: string | null
          revisao_sistemas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_clinica_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_clinica_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "paciente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_clinica_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
        ]
      }
      baixa_lancamento: {
        Row: {
          clinica_id: string
          conta_bancaria_id: string
          created_at: string
          data: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          lancamento_id: string
          movimentacao_conta_id: string | null
          observacao: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          clinica_id: string
          conta_bancaria_id: string
          created_at?: string
          data?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lancamento_id: string
          movimentacao_conta_id?: string | null
          observacao?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          clinica_id?: string
          conta_bancaria_id?: string
          created_at?: string
          data?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lancamento_id?: string
          movimentacao_conta_id?: string | null
          observacao?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "baixa_lancamento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baixa_lancamento_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "conta_bancaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baixa_lancamento_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "saldo_conta_bancaria"
            referencedColumns: ["conta_bancaria_id"]
          },
          {
            foreignKeyName: "baixa_lancamento_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baixa_lancamento_movimentacao_fk"
            columns: ["movimentacao_conta_id"]
            isOneToOne: false
            referencedRelation: "movimentacao_conta"
            referencedColumns: ["id"]
          },
        ]
      }
      campanha: {
        Row: {
          canais: string[]
          clinica_id: string
          conteudo: Json
          created_at: string
          data_agendado: string | null
          data_envio: string | null
          descricao: string | null
          filtros: Json
          id: string
          nome: string
          quantidade_destinatarios: number
          quantidade_enviados: number
          status: Database["public"]["Enums"]["status_campanha"]
          updated_at: string
        }
        Insert: {
          canais?: string[]
          clinica_id: string
          conteudo?: Json
          created_at?: string
          data_agendado?: string | null
          data_envio?: string | null
          descricao?: string | null
          filtros?: Json
          id?: string
          nome: string
          quantidade_destinatarios?: number
          quantidade_enviados?: number
          status?: Database["public"]["Enums"]["status_campanha"]
          updated_at?: string
        }
        Update: {
          canais?: string[]
          clinica_id?: string
          conteudo?: Json
          created_at?: string
          data_agendado?: string | null
          data_envio?: string | null
          descricao?: string | null
          filtros?: Json
          id?: string
          nome?: string
          quantidade_destinatarios?: number
          quantidade_enviados?: number
          status?: Database["public"]["Enums"]["status_campanha"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanha_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      categoria_lancamento: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categoria_lancamento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      centro_custo: {
        Row: {
          ativo: boolean
          clinica_id: string
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centro_custo_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      clinica: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          config: Json
          created_at: string
          email: string | null
          exibir_marketplace: boolean
          fotos: Json
          horarios: Json
          id: string
          logo_path: string | null
          logradouro: string | null
          nome: string
          numero: string | null
          razao_social: string | null
          retencao_fiscal_meses: number | null
          retencao_marketing_meses: number | null
          retencao_prontuario_meses: number | null
          slug: string | null
          sobre: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_clinica"]
          uf: string | null
          updated_at: string
          validade_anamnese_dias: number
          validade_orcamento_dias: number
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          config?: Json
          created_at?: string
          email?: string | null
          exibir_marketplace?: boolean
          fotos?: Json
          horarios?: Json
          id?: string
          logo_path?: string | null
          logradouro?: string | null
          nome: string
          numero?: string | null
          razao_social?: string | null
          retencao_fiscal_meses?: number | null
          retencao_marketing_meses?: number | null
          retencao_prontuario_meses?: number | null
          slug?: string | null
          sobre?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_clinica"]
          uf?: string | null
          updated_at?: string
          validade_anamnese_dias?: number
          validade_orcamento_dias?: number
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          config?: Json
          created_at?: string
          email?: string | null
          exibir_marketplace?: boolean
          fotos?: Json
          horarios?: Json
          id?: string
          logo_path?: string | null
          logradouro?: string | null
          nome?: string
          numero?: string | null
          razao_social?: string | null
          retencao_fiscal_meses?: number | null
          retencao_marketing_meses?: number | null
          retencao_prontuario_meses?: number | null
          slug?: string | null
          sobre?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_clinica"]
          uf?: string | null
          updated_at?: string
          validade_anamnese_dias?: number
          validade_orcamento_dias?: number
        }
        Relationships: []
      }
      clinica_especialidade: {
        Row: {
          clinica_id: string
          created_at: string
          especialidade_id: string
          id: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          especialidade_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          especialidade_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinica_especialidade_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinica_especialidade_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidade"
            referencedColumns: ["id"]
          },
        ]
      }
      clinica_usuario: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          id: string
          papel: Database["public"]["Enums"]["papel_clinica"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          id?: string
          papel: Database["public"]["Enums"]["papel_clinica"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          id?: string
          papel?: Database["public"]["Enums"]["papel_clinica"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinica_usuario_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      comissao: {
        Row: {
          base_calculo: number | null
          clinica_id: string
          consulta_id: string | null
          created_at: string
          id: string
          item_orcamento_id: string | null
          lancamento_id: string | null
          observacoes: string | null
          profissional_id: string
          status: Database["public"]["Enums"]["status_comissao"]
          tipo_comissao: Database["public"]["Enums"]["tipo_comissao"]
          updated_at: string
          valor: number
          venda_id: string | null
        }
        Insert: {
          base_calculo?: number | null
          clinica_id: string
          consulta_id?: string | null
          created_at?: string
          id?: string
          item_orcamento_id?: string | null
          lancamento_id?: string | null
          observacoes?: string | null
          profissional_id: string
          status?: Database["public"]["Enums"]["status_comissao"]
          tipo_comissao: Database["public"]["Enums"]["tipo_comissao"]
          updated_at?: string
          valor: number
          venda_id?: string | null
        }
        Update: {
          base_calculo?: number | null
          clinica_id?: string
          consulta_id?: string | null
          created_at?: string
          id?: string
          item_orcamento_id?: string | null
          lancamento_id?: string | null
          observacoes?: string | null
          profissional_id?: string
          status?: Database["public"]["Enums"]["status_comissao"]
          tipo_comissao?: Database["public"]["Enums"]["tipo_comissao"]
          updated_at?: string
          valor?: number
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comissao_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consulta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "item_orcamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "venda"
            referencedColumns: ["id"]
          },
        ]
      }
      composicao_servico: {
        Row: {
          clinica_id: string
          created_at: string
          id: string
          item_estoque_id: string
          quantidade: number
          servico_id: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          id?: string
          item_estoque_id: string
          quantidade: number
          servico_id: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          id?: string
          item_estoque_id?: string
          quantidade?: number
          servico_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "composicao_servico_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composicao_servico_item_estoque_id_fkey"
            columns: ["item_estoque_id"]
            isOneToOne: false
            referencedRelation: "item_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composicao_servico_item_estoque_id_fkey"
            columns: ["item_estoque_id"]
            isOneToOne: false
            referencedRelation: "saldo_item_estoque"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "composicao_servico_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servico"
            referencedColumns: ["id"]
          },
        ]
      }
      consentimento_evento: {
        Row: {
          clinica_id: string
          created_at: string
          detalhe: string | null
          documento_id: string | null
          id: string
          ip: unknown
          origem: string
          paciente_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          detalhe?: string | null
          documento_id?: string | null
          id?: string
          ip?: unknown
          origem?: string
          paciente_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          detalhe?: string | null
          documento_id?: string | null
          id?: string
          ip?: unknown
          origem?: string
          paciente_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consentimento_evento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consentimento_evento_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documento_consentimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consentimento_evento_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "paciente"
            referencedColumns: ["id"]
          },
        ]
      }
      consulta: {
        Row: {
          clinica_id: string
          convenio_id: string | null
          created_at: string
          data_hora: string
          duracao_minutos: number
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          motivo_cancelamento: string | null
          numero_guia: string | null
          observacoes: string | null
          paciente_id: string
          profissional_id: string
          status: Database["public"]["Enums"]["status_consulta"]
          tipo: Database["public"]["Enums"]["tipo_consulta"]
          updated_at: string
          valor: number | null
        }
        Insert: {
          clinica_id: string
          convenio_id?: string | null
          created_at?: string
          data_hora: string
          duracao_minutos?: number
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          motivo_cancelamento?: string | null
          numero_guia?: string | null
          observacoes?: string | null
          paciente_id: string
          profissional_id: string
          status?: Database["public"]["Enums"]["status_consulta"]
          tipo?: Database["public"]["Enums"]["tipo_consulta"]
          updated_at?: string
          valor?: number | null
        }
        Update: {
          clinica_id?: string
          convenio_id?: string | null
          created_at?: string
          data_hora?: string
          duracao_minutos?: number
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          motivo_cancelamento?: string | null
          numero_guia?: string | null
          observacoes?: string | null
          paciente_id?: string
          profissional_id?: string
          status?: Database["public"]["Enums"]["status_consulta"]
          tipo?: Database["public"]["Enums"]["tipo_consulta"]
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consulta_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulta_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulta_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "paciente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulta_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
        ]
      }
      consulta_servico: {
        Row: {
          clinica_id: string
          consulta_id: string
          created_at: string
          id: string
          item_orcamento_id: string | null
          servico_id: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          consulta_id: string
          created_at?: string
          id?: string
          item_orcamento_id?: string | null
          servico_id: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          consulta_id?: string
          created_at?: string
          id?: string
          item_orcamento_id?: string | null
          servico_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consulta_servico_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulta_servico_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consulta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulta_servico_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "item_orcamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulta_servico_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servico"
            referencedColumns: ["id"]
          },
        ]
      }
      conta_bancaria: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          clinica_id: string
          created_at: string
          id: string
          nome: string
          numero_conta: string | null
          saldo_inicial: number
          tipo: Database["public"]["Enums"]["tipo_conta_bancaria"]
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          clinica_id: string
          created_at?: string
          id?: string
          nome: string
          numero_conta?: string | null
          saldo_inicial?: number
          tipo?: Database["public"]["Enums"]["tipo_conta_bancaria"]
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          clinica_id?: string
          created_at?: string
          id?: string
          nome?: string
          numero_conta?: string | null
          saldo_inicial?: number
          tipo?: Database["public"]["Enums"]["tipo_conta_bancaria"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conta_bancaria_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      convenio: {
        Row: {
          ativo: boolean
          clinica_id: string
          codigo: string | null
          contato: string | null
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          prazo_pagamento_dias: number | null
          tipo: Database["public"]["Enums"]["tipo_convenio"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          codigo?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          prazo_pagamento_dias?: number | null
          tipo?: Database["public"]["Enums"]["tipo_convenio"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          codigo?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          prazo_pagamento_dias?: number | null
          tipo?: Database["public"]["Enums"]["tipo_convenio"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "convenio_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      cupom: {
        Row: {
          clinica_id: string
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          quantidade_usos: number
          regras_uso: string | null
          status: Database["public"]["Enums"]["status_cupom"]
          tipo_desconto: Database["public"]["Enums"]["tipo_desconto"]
          updated_at: string
          validade_fim: string | null
          validade_inicio: string | null
          valor_desconto: number
        }
        Insert: {
          clinica_id: string
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          quantidade_usos?: number
          regras_uso?: string | null
          status?: Database["public"]["Enums"]["status_cupom"]
          tipo_desconto?: Database["public"]["Enums"]["tipo_desconto"]
          updated_at?: string
          validade_fim?: string | null
          validade_inicio?: string | null
          valor_desconto: number
        }
        Update: {
          clinica_id?: string
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          quantidade_usos?: number
          regras_uso?: string | null
          status?: Database["public"]["Enums"]["status_cupom"]
          tipo_desconto?: Database["public"]["Enums"]["tipo_desconto"]
          updated_at?: string
          validade_fim?: string | null
          validade_inicio?: string | null
          valor_desconto?: number
        }
        Relationships: [
          {
            foreignKeyName: "cupom_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      depoimento: {
        Row: {
          clinica_id: string
          created_at: string
          destaque: boolean
          foto_path: string | null
          id: string
          nota: number | null
          origem: Database["public"]["Enums"]["origem_depoimento"]
          paciente_id: string | null
          paciente_nome: string
          profissional_id: string | null
          publicar_no_site: boolean
          servico_id: string | null
          status: Database["public"]["Enums"]["status_depoimento"]
          texto: string
          token_solicitacao: string | null
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          destaque?: boolean
          foto_path?: string | null
          id?: string
          nota?: number | null
          origem?: Database["public"]["Enums"]["origem_depoimento"]
          paciente_id?: string | null
          paciente_nome: string
          profissional_id?: string | null
          publicar_no_site?: boolean
          servico_id?: string | null
          status?: Database["public"]["Enums"]["status_depoimento"]
          texto: string
          token_solicitacao?: string | null
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          destaque?: boolean
          foto_path?: string | null
          id?: string
          nota?: number | null
          origem?: Database["public"]["Enums"]["origem_depoimento"]
          paciente_id?: string | null
          paciente_nome?: string
          profissional_id?: string | null
          publicar_no_site?: boolean
          servico_id?: string | null
          status?: Database["public"]["Enums"]["status_depoimento"]
          texto?: string
          token_solicitacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "depoimento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depoimento_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "paciente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depoimento_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depoimento_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servico"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_consentimento: {
        Row: {
          arquivo_path: string | null
          assinatura_path: string | null
          clinica_id: string
          conteudo: string | null
          created_at: string
          data_assinatura: string | null
          data_revogacao: string | null
          id: string
          ip_assinatura: unknown
          observacoes: string | null
          paciente_id: string
          profissional_id: string | null
          status: Database["public"]["Enums"]["status_documento"]
          tipo: Database["public"]["Enums"]["tipo_documento"]
          titulo: string
          updated_at: string
          versao: string | null
        }
        Insert: {
          arquivo_path?: string | null
          assinatura_path?: string | null
          clinica_id: string
          conteudo?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_revogacao?: string | null
          id?: string
          ip_assinatura?: unknown
          observacoes?: string | null
          paciente_id: string
          profissional_id?: string | null
          status?: Database["public"]["Enums"]["status_documento"]
          tipo: Database["public"]["Enums"]["tipo_documento"]
          titulo: string
          updated_at?: string
          versao?: string | null
        }
        Update: {
          arquivo_path?: string | null
          assinatura_path?: string | null
          clinica_id?: string
          conteudo?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_revogacao?: string | null
          id?: string
          ip_assinatura?: unknown
          observacoes?: string | null
          paciente_id?: string
          profissional_id?: string | null
          status?: Database["public"]["Enums"]["status_documento"]
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          titulo?: string
          updated_at?: string
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_consentimento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_consentimento_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "paciente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_consentimento_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
        ]
      }
      especialidade: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          segmento_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          segmento_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          segmento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "especialidade_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmento"
            referencedColumns: ["id"]
          },
        ]
      }
      evolucao_insumo: {
        Row: {
          clinica_id: string
          created_at: string
          evolucao_id: string
          fabricante: string | null
          id: string
          item_estoque_id: string | null
          lote: string | null
          movimentacao_estoque_id: string | null
          produto_nome: string
          quantidade: string | null
          updated_at: string
          validade: string | null
        }
        Insert: {
          clinica_id: string
          created_at?: string
          evolucao_id: string
          fabricante?: string | null
          id?: string
          item_estoque_id?: string | null
          lote?: string | null
          movimentacao_estoque_id?: string | null
          produto_nome: string
          quantidade?: string | null
          updated_at?: string
          validade?: string | null
        }
        Update: {
          clinica_id?: string
          created_at?: string
          evolucao_id?: string
          fabricante?: string | null
          id?: string
          item_estoque_id?: string | null
          lote?: string | null
          movimentacao_estoque_id?: string | null
          produto_nome?: string
          quantidade?: string | null
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolucao_insumo_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_insumo_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "evolucao_sessao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_insumo_item_estoque_id_fkey"
            columns: ["item_estoque_id"]
            isOneToOne: false
            referencedRelation: "item_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_insumo_item_estoque_id_fkey"
            columns: ["item_estoque_id"]
            isOneToOne: false
            referencedRelation: "saldo_item_estoque"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "evolucao_insumo_movimentacao_estoque_id_fkey"
            columns: ["movimentacao_estoque_id"]
            isOneToOne: false
            referencedRelation: "movimentacao_estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      evolucao_sessao: {
        Row: {
          clinica_id: string
          consulta_id: string | null
          created_at: string
          data_hora: string
          descricao_atendimento: string | null
          descricao_origem: string
          fotos: Json
          id: string
          intercorrencias: string | null
          numero_sessao: number | null
          orcamento_id: string | null
          orientacoes_pos: string | null
          paciente_id: string
          prescricao: string | null
          profissional_id: string | null
          proxima_sessao_sugerida: string | null
          reacao_paciente: string | null
          transcricao_audio_path: string | null
          transcricao_status: string | null
          transcricao_texto_bruto: string | null
          updated_at: string
        }
        Insert: {
          clinica_id: string
          consulta_id?: string | null
          created_at?: string
          data_hora?: string
          descricao_atendimento?: string | null
          descricao_origem?: string
          fotos?: Json
          id?: string
          intercorrencias?: string | null
          numero_sessao?: number | null
          orcamento_id?: string | null
          orientacoes_pos?: string | null
          paciente_id: string
          prescricao?: string | null
          profissional_id?: string | null
          proxima_sessao_sugerida?: string | null
          reacao_paciente?: string | null
          transcricao_audio_path?: string | null
          transcricao_status?: string | null
          transcricao_texto_bruto?: string | null
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          consulta_id?: string | null
          created_at?: string
          data_hora?: string
          descricao_atendimento?: string | null
          descricao_origem?: string
          fotos?: Json
          id?: string
          intercorrencias?: string | null
          numero_sessao?: number | null
          orcamento_id?: string | null
          orientacoes_pos?: string | null
          paciente_id?: string
          prescricao?: string | null
          profissional_id?: string | null
          proxima_sessao_sugerida?: string | null
          reacao_paciente?: string | null
          transcricao_audio_path?: string | null
          transcricao_status?: string | null
          transcricao_texto_bruto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolucao_sessao_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_sessao_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consulta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_sessao_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_sessao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "paciente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_sessao_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
        ]
      }
      formulario_anamnese: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          perguntas: Json
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          perguntas?: Json
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          perguntas?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formulario_anamnese_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      galeria_foto: {
        Row: {
          categoria: string
          clinica_id: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          origem: string
          paciente_id: string
          path: string
          profissional_id: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string
          clinica_id: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          origem?: string
          paciente_id: string
          path: string
          profissional_id?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string
          clinica_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          origem?: string
          paciente_id?: string
          path?: string
          profissional_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "galeria_foto_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galeria_foto_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "paciente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galeria_foto_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
        ]
      }
      item_estoque: {
        Row: {
          ativo: boolean
          categoria: string | null
          classificacao: Database["public"]["Enums"]["classificacao_item_estoque"]
          clinica_id: string
          codigo: string | null
          created_at: string
          descricao: string
          estoque_minimo: number
          fornecedor: string | null
          id: string
          para_venda: boolean
          preco_custo: number | null
          preco_venda: number | null
          requer_validade: boolean
          unidade: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          classificacao?: Database["public"]["Enums"]["classificacao_item_estoque"]
          clinica_id: string
          codigo?: string | null
          created_at?: string
          descricao: string
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          para_venda?: boolean
          preco_custo?: number | null
          preco_venda?: number | null
          requer_validade?: boolean
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          classificacao?: Database["public"]["Enums"]["classificacao_item_estoque"]
          clinica_id?: string
          codigo?: string | null
          created_at?: string
          descricao?: string
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          para_venda?: boolean
          preco_custo?: number | null
          preco_venda?: number | null
          requer_validade?: boolean
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_estoque_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      item_orcamento: {
        Row: {
          clinica_id: string
          created_at: string
          id: string
          observacao: string | null
          orcamento_id: string
          quantidade: number
          regioes: string[]
          servico_id: string
          sessoes_realizadas: number
          tipo_valor: Database["public"]["Enums"]["tipo_valor_preco"]
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          clinica_id: string
          created_at?: string
          id?: string
          observacao?: string | null
          orcamento_id: string
          quantidade?: number
          regioes?: string[]
          servico_id: string
          sessoes_realizadas?: number
          tipo_valor?: Database["public"]["Enums"]["tipo_valor_preco"]
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          clinica_id?: string
          created_at?: string
          id?: string
          observacao?: string | null
          orcamento_id?: string
          quantidade?: number
          regioes?: string[]
          servico_id?: string
          sessoes_realizadas?: number
          tipo_valor?: Database["public"]["Enums"]["tipo_valor_preco"]
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_orcamento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_orcamento_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_orcamento_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servico"
            referencedColumns: ["id"]
          },
        ]
      }
      item_tabela_preco: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          id: string
          servico_id: string
          tabela_preco_id: string
          tipo_valor: Database["public"]["Enums"]["tipo_valor_preco"]
          updated_at: string
          valor: number | null
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          id?: string
          servico_id: string
          tabela_preco_id: string
          tipo_valor?: Database["public"]["Enums"]["tipo_valor_preco"]
          updated_at?: string
          valor?: number | null
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          id?: string
          servico_id?: string
          tabela_preco_id?: string
          tipo_valor?: Database["public"]["Enums"]["tipo_valor_preco"]
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_tabela_preco_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_tabela_preco_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_tabela_preco_tabela_preco_id_fkey"
            columns: ["tabela_preco_id"]
            isOneToOne: false
            referencedRelation: "tabela_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamento_financeiro: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          clinica_id: string
          consulta_id: string | null
          convenio_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          observacoes: string | null
          paciente_id: string | null
          profissional_id: string | null
          status: Database["public"]["Enums"]["status_lancamento"]
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at: string
          valor: number
          valor_pago: number
          venda_id: string | null
        }
        Insert: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          clinica_id: string
          consulta_id?: string | null
          convenio_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          profissional_id?: string | null
          status?: Database["public"]["Enums"]["status_lancamento"]
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string
          valor: number
          valor_pago?: number
          venda_id?: string | null
        }
        Update: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          clinica_id?: string
          consulta_id?: string | null
          convenio_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          profissional_id?: string | null
          status?: Database["public"]["Enums"]["status_lancamento"]
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string
          valor?: number
          valor_pago?: number
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamento_financeiro_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria_lancamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_financeiro_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centro_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_financeiro_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_financeiro_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consulta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_financeiro_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_financeiro_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "paciente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_financeiro_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_financeiro_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "venda"
            referencedColumns: ["id"]
          },
        ]
      }
      lead: {
        Row: {
          clinica_id: string | null
          created_at: string
          cupom_id: string | null
          id: string
          nome: string
          origem: Database["public"]["Enums"]["origem_lead"]
          status: Database["public"]["Enums"]["status_lead"]
          telefone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          clinica_id?: string | null
          created_at?: string
          cupom_id?: string | null
          id?: string
          nome: string
          origem?: Database["public"]["Enums"]["origem_lead"]
          status?: Database["public"]["Enums"]["status_lead"]
          telefone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          clinica_id?: string | null
          created_at?: string
          cupom_id?: string | null
          id?: string
          nome?: string
          origem?: Database["public"]["Enums"]["origem_lead"]
          status?: Database["public"]["Enums"]["status_lead"]
          telefone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupom"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sala_vip: {
        Row: {
          clinica_id: string
          created_at: string
          data_interesse: string
          email: string | null
          id: string
          nome: string
          sala_vip_id: string
          status: Database["public"]["Enums"]["status_lead_sala_vip"]
          telefone: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          data_interesse?: string
          email?: string | null
          id?: string
          nome: string
          sala_vip_id: string
          status?: Database["public"]["Enums"]["status_lead_sala_vip"]
          telefone: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          data_interesse?: string
          email?: string | null
          id?: string
          nome?: string
          sala_vip_id?: string
          status?: Database["public"]["Enums"]["status_lead_sala_vip"]
          telefone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sala_vip_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sala_vip_sala_vip_id_fkey"
            columns: ["sala_vip_id"]
            isOneToOne: false
            referencedRelation: "sala_vip"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacao_conta: {
        Row: {
          clinica_id: string
          conciliada: boolean
          conta_bancaria_id: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          lancamento_id: string | null
          observacao: string | null
          tipo: Database["public"]["Enums"]["tipo_movimentacao_conta"]
          updated_at: string
          valor: number
        }
        Insert: {
          clinica_id: string
          conciliada?: boolean
          conta_bancaria_id: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          lancamento_id?: string | null
          observacao?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimentacao_conta"]
          updated_at?: string
          valor: number
        }
        Update: {
          clinica_id?: string
          conciliada?: boolean
          conta_bancaria_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          lancamento_id?: string | null
          observacao?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimentacao_conta"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacao_conta_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacao_conta_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "conta_bancaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacao_conta_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "saldo_conta_bancaria"
            referencedColumns: ["conta_bancaria_id"]
          },
          {
            foreignKeyName: "movimentacao_conta_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamento_financeiro"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacao_estoque: {
        Row: {
          centro_custo_id: string | null
          clinica_id: string
          created_at: string
          data: string
          fornecedor: string | null
          id: string
          item_id: string
          lancamento_id: string | null
          lote: string | null
          observacao: string | null
          preco_unitario: number | null
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_movimentacao_estoque"]
          updated_at: string
          validade: string | null
          valor_total: number | null
        }
        Insert: {
          centro_custo_id?: string | null
          clinica_id: string
          created_at?: string
          data?: string
          fornecedor?: string | null
          id?: string
          item_id: string
          lancamento_id?: string | null
          lote?: string | null
          observacao?: string | null
          preco_unitario?: number | null
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_movimentacao_estoque"]
          updated_at?: string
          validade?: string | null
          valor_total?: number | null
        }
        Update: {
          centro_custo_id?: string | null
          clinica_id?: string
          created_at?: string
          data?: string
          fornecedor?: string | null
          id?: string
          item_id?: string
          lancamento_id?: string | null
          lote?: string | null
          observacao?: string | null
          preco_unitario?: number | null
          quantidade?: number
          tipo?: Database["public"]["Enums"]["tipo_movimentacao_estoque"]
          updated_at?: string
          validade?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacao_estoque_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centro_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacao_estoque_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacao_estoque_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacao_estoque_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "saldo_item_estoque"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "movimentacao_estoque_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamento_financeiro"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento: {
        Row: {
          anotacoes_internas: string | null
          clinica_id: string
          convenio_id: string | null
          created_at: string
          desconto: number
          id: string
          observacoes: string | null
          paciente_id: string
          profissional_id: string | null
          status: Database["public"]["Enums"]["status_orcamento"]
          tabela_preco_id: string | null
          tipo_desconto: Database["public"]["Enums"]["tipo_desconto"]
          updated_at: string
          validade_dias: number
          valor_final: number
          valor_total: number
        }
        Insert: {
          anotacoes_internas?: string | null
          clinica_id: string
          convenio_id?: string | null
          created_at?: string
          desconto?: number
          id?: string
          observacoes?: string | null
          paciente_id: string
          profissional_id?: string | null
          status?: Database["public"]["Enums"]["status_orcamento"]
          tabela_preco_id?: string | null
          tipo_desconto?: Database["public"]["Enums"]["tipo_desconto"]
          updated_at?: string
          validade_dias?: number
          valor_final?: number
          valor_total?: number
        }
        Update: {
          anotacoes_internas?: string | null
          clinica_id?: string
          convenio_id?: string | null
          created_at?: string
          desconto?: number
          id?: string
          observacoes?: string | null
          paciente_id?: string
          profissional_id?: string | null
          status?: Database["public"]["Enums"]["status_orcamento"]
          tabela_preco_id?: string | null
          tipo_desconto?: Database["public"]["Enums"]["tipo_desconto"]
          updated_at?: string
          validade_dias?: number
          valor_final?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "paciente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_tabela_preco_id_fkey"
            columns: ["tabela_preco_id"]
            isOneToOne: false
            referencedRelation: "tabela_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      paciente: {
        Row: {
          anonimizado: boolean
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          contato_emergencia_nome: string | null
          contato_emergencia_parentesco: string | null
          contato_emergencia_telefone: string | null
          cpf: string | null
          created_at: string
          data_aceite_termos: string | null
          data_anonimizacao: string | null
          data_nascimento: string | null
          email: string | null
          id: string
          ip_aceite: unknown
          logradouro: string | null
          motivo_exclusao: string | null
          nome: string
          nome_mae: string | null
          numero: string | null
          observacoes: string | null
          sexo: Database["public"]["Enums"]["sexo"] | null
          telefone: string | null
          termos_aceitos: boolean
          uf: string | null
          updated_at: string
          user_id: string | null
          versao_termos_aceita: string | null
        }
        Insert: {
          anonimizado?: boolean
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          contato_emergencia_nome?: string | null
          contato_emergencia_parentesco?: string | null
          contato_emergencia_telefone?: string | null
          cpf?: string | null
          created_at?: string
          data_aceite_termos?: string | null
          data_anonimizacao?: string | null
          data_nascimento?: string | null
          email?: string | null
          id?: string
          ip_aceite?: unknown
          logradouro?: string | null
          motivo_exclusao?: string | null
          nome: string
          nome_mae?: string | null
          numero?: string | null
          observacoes?: string | null
          sexo?: Database["public"]["Enums"]["sexo"] | null
          telefone?: string | null
          termos_aceitos?: boolean
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          versao_termos_aceita?: string | null
        }
        Update: {
          anonimizado?: boolean
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          contato_emergencia_nome?: string | null
          contato_emergencia_parentesco?: string | null
          contato_emergencia_telefone?: string | null
          cpf?: string | null
          created_at?: string
          data_aceite_termos?: string | null
          data_anonimizacao?: string | null
          data_nascimento?: string | null
          email?: string | null
          id?: string
          ip_aceite?: unknown
          logradouro?: string | null
          motivo_exclusao?: string | null
          nome?: string
          nome_mae?: string | null
          numero?: string | null
          observacoes?: string | null
          sexo?: Database["public"]["Enums"]["sexo"] | null
          telefone?: string | null
          termos_aceitos?: boolean
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          versao_termos_aceita?: string | null
        }
        Relationships: []
      }
      paciente_clinica: {
        Row: {
          ativo: boolean
          clinica_id: string
          convenio_id: string | null
          created_at: string
          id: string
          numero_carteirinha: string | null
          observacoes: string | null
          origem: string | null
          paciente_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          convenio_id?: string | null
          created_at?: string
          id?: string
          numero_carteirinha?: string | null
          observacoes?: string | null
          origem?: string | null
          paciente_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          convenio_id?: string | null
          created_at?: string
          id?: string
          numero_carteirinha?: string | null
          observacoes?: string | null
          origem?: string | null
          paciente_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paciente_clinica_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paciente_clinica_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paciente_clinica_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "paciente"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamento: {
        Row: {
          clinica_id: string
          created_at: string
          data_pagamento: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          lancamento_id: string | null
          numero_parcela: number
          pago: boolean
          updated_at: string
          valor: number
          vencimento: string
          venda_id: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lancamento_id?: string | null
          numero_parcela?: number
          pago?: boolean
          updated_at?: string
          valor: number
          vencimento: string
          venda_id: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lancamento_id?: string | null
          numero_parcela?: number
          pago?: boolean
          updated_at?: string
          valor?: number
          vencimento?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamento_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamento_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "venda"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_assinatura: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          limites: Json
          nome: string
          permissoes: Json
          preco_mensal: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          limites?: Json
          nome: string
          permissoes?: Json
          preco_mensal: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          limites?: Json
          nome?: string
          permissoes?: Json
          preco_mensal?: number
          updated_at?: string
        }
        Relationships: []
      }
      profissional: {
        Row: {
          ativo: boolean
          clinica_id: string
          cor: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          dias_atendimento: number[]
          email: string | null
          foto_path: string | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          nome: string
          nome_conselho: string | null
          numero_registro: string | null
          sexo: Database["public"]["Enums"]["sexo"] | null
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          cor?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          dias_atendimento?: number[]
          email?: string | null
          foto_path?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          nome: string
          nome_conselho?: string | null
          numero_registro?: string | null
          sexo?: Database["public"]["Enums"]["sexo"] | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          cor?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          dias_atendimento?: number[]
          email?: string | null
          foto_path?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          nome?: string
          nome_conselho?: string | null
          numero_registro?: string | null
          sexo?: Database["public"]["Enums"]["sexo"] | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profissional_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional_convenio: {
        Row: {
          clinica_id: string
          convenio_id: string
          created_at: string
          id: string
          profissional_id: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          convenio_id: string
          created_at?: string
          id?: string
          profissional_id: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          convenio_id?: string
          created_at?: string
          id?: string
          profissional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissional_convenio_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_convenio_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_convenio_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional_especialidade: {
        Row: {
          clinica_id: string
          created_at: string
          especialidade_id: string
          id: string
          profissional_id: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          especialidade_id: string
          id?: string
          profissional_id: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          especialidade_id?: string
          id?: string
          profissional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissional_especialidade_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_especialidade_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_especialidade_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional_intervalo: {
        Row: {
          clinica_id: string
          created_at: string
          data_hora_fim: string | null
          data_hora_inicio: string | null
          dia_semana: number | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          motivo: string
          profissional_id: string
          tipo: Database["public"]["Enums"]["tipo_intervalo"]
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          data_hora_fim?: string | null
          data_hora_inicio?: string | null
          dia_semana?: number | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string
          profissional_id: string
          tipo?: Database["public"]["Enums"]["tipo_intervalo"]
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          data_hora_fim?: string | null
          data_hora_inicio?: string | null
          dia_semana?: number | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string
          profissional_id?: string
          tipo?: Database["public"]["Enums"]["tipo_intervalo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissional_intervalo_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_intervalo_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional_servico: {
        Row: {
          clinica_id: string
          created_at: string
          id: string
          profissional_id: string
          servico_id: string
          tipo_comissao: Database["public"]["Enums"]["tipo_comissao"]
          updated_at: string
          valor_comissao: number
        }
        Insert: {
          clinica_id: string
          created_at?: string
          id?: string
          profissional_id: string
          servico_id: string
          tipo_comissao?: Database["public"]["Enums"]["tipo_comissao"]
          updated_at?: string
          valor_comissao?: number
        }
        Update: {
          clinica_id?: string
          created_at?: string
          id?: string
          profissional_id?: string
          servico_id?: string
          tipo_comissao?: Database["public"]["Enums"]["tipo_comissao"]
          updated_at?: string
          valor_comissao?: number
        }
        Relationships: [
          {
            foreignKeyName: "profissional_servico_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_servico_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_servico_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servico"
            referencedColumns: ["id"]
          },
        ]
      }
      resposta_anamnese: {
        Row: {
          clinica_id: string
          consulta_id: string | null
          created_at: string
          data_preenchimento: string | null
          expira_em: string | null
          formulario_id: string
          id: string
          paciente_id: string
          respostas: Json
          status: Database["public"]["Enums"]["status_anamnese"]
          token: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          consulta_id?: string | null
          created_at?: string
          data_preenchimento?: string | null
          expira_em?: string | null
          formulario_id: string
          id?: string
          paciente_id: string
          respostas?: Json
          status?: Database["public"]["Enums"]["status_anamnese"]
          token?: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          consulta_id?: string | null
          created_at?: string
          data_preenchimento?: string | null
          expira_em?: string | null
          formulario_id?: string
          id?: string
          paciente_id?: string
          respostas?: Json
          status?: Database["public"]["Enums"]["status_anamnese"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resposta_anamnese_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resposta_anamnese_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consulta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resposta_anamnese_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formulario_anamnese"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resposta_anamnese_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "paciente"
            referencedColumns: ["id"]
          },
        ]
      }
      sala_vip: {
        Row: {
          ativa: boolean
          beneficios: string | null
          clinica_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          quantidade_vagas: number
          status: Database["public"]["Enums"]["status_sala_vip"]
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          beneficios?: string | null
          clinica_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          quantidade_vagas?: number
          status?: Database["public"]["Enums"]["status_sala_vip"]
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          beneficios?: string | null
          clinica_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          quantidade_vagas?: number
          status?: Database["public"]["Enums"]["status_sala_vip"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sala_vip_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      segmento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      servico: {
        Row: {
          ativo: boolean
          clinica_id: string
          codigo: string | null
          created_at: string
          descricao: string | null
          duracao_minutos: number
          especialidade_id: string | null
          exibir_publico: boolean
          id: string
          markup_percentual: number | null
          nome: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number
          especialidade_id?: string | null
          exibir_publico?: boolean
          id?: string
          markup_percentual?: number | null
          nome: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number
          especialidade_id?: string | null
          exibir_publico?: boolean
          id?: string
          markup_percentual?: number | null
          nome?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servico_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servico_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidade"
            referencedColumns: ["id"]
          },
        ]
      }
      tabela_preco: {
        Row: {
          ativo: boolean
          clinica_id: string
          convenio_id: string | null
          created_at: string
          descricao: string | null
          exibir_publico: boolean
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          convenio_id?: string | null
          created_at?: string
          descricao?: string | null
          exibir_publico?: boolean
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          convenio_id?: string | null
          created_at?: string
          descricao?: string | null
          exibir_publico?: boolean
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabela_preco_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabela_preco_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenio"
            referencedColumns: ["id"]
          },
        ]
      }
      venda: {
        Row: {
          cancelada: boolean
          clinica_id: string
          created_at: string
          data_hora: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          observacoes: string | null
          orcamento_id: string
          updated_at: string
        }
        Insert: {
          cancelada?: boolean
          clinica_id: string
          created_at?: string
          data_hora?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          observacoes?: string | null
          orcamento_id: string
          updated_at?: string
        }
        Update: {
          cancelada?: boolean
          clinica_id?: string
          created_at?: string
          data_hora?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          observacoes?: string | null
          orcamento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: true
            referencedRelation: "orcamento"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      saldo_conta_bancaria: {
        Row: {
          clinica_id: string | null
          conta_bancaria_id: string | null
          nome: string | null
          saldo_atual: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conta_bancaria_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
      saldo_item_estoque: {
        Row: {
          clinica_id: string | null
          descricao: string | null
          estoque_minimo: number | null
          item_id: string | null
          saldo_atual: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_estoque_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinica"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      abrir_solicitacao_lgpd: {
        Args: { p_detalhe: string; p_tipo: string }
        Returns: undefined
      }
      anonimizar_paciente: {
        Args: { p_motivo: string; p_paciente_id: string }
        Returns: string[]
      }
      baixar_insumos_evolucao: {
        Args: { p_evolucao_id: string }
        Returns: number
      }
      consentimento_vigente: {
        Args: {
          p_clinica_id: string
          p_paciente_id: string
          p_tipo: Database["public"]["Enums"]["tipo_documento"]
        }
        Returns: boolean
      }
      criar_consulta_retorno: {
        Args: {
          p_data_hora: string
          p_duracao_minutos?: number
          p_evolucao_id: string
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      registrar_saida_estoque: {
        Args: {
          p_clinica_id: string
          p_data: string
          p_linhas: Json
          p_observacao: string
        }
        Returns: number
      }
      remover_insumo_evolucao: {
        Args: { p_insumo_id: string }
        Returns: undefined
      }
      salvar_paciente_clinica: {
        Args: {
          p_clinica_id: string
          p_dados?: Json
          p_paciente_id?: string
          p_vinculo?: Json
        }
        Returns: string
      }
    }
    Enums: {
      classificacao_item_estoque:
        | "material_consumo"
        | "medicamento"
        | "equipamento"
        | "limpeza"
        | "descartavel"
        | "produto_venda"
        | "outros"
      forma_pagamento:
        | "dinheiro"
        | "cartao_debito"
        | "cartao_credito"
        | "pix"
        | "transferencia"
        | "boleto"
        | "convenio"
        | "outro"
      origem_depoimento: "manual" | "solicitado" | "google" | "whatsapp"
      origem_lead: "cupom" | "lista_vip" | "marketplace"
      papel_clinica:
        | "proprietario"
        | "gerente"
        | "recepcionista"
        | "assistente"
        | "profissional"
      sexo: "masculino" | "feminino" | "outro"
      status_anamnese: "pendente" | "preenchido"
      status_assinatura: "ativa" | "pausada" | "cancelada"
      status_campanha: "draft" | "agendada" | "ativa" | "pausada" | "finalizada"
      status_comissao: "pendente" | "paga" | "cancelada"
      status_consulta:
        | "agendado"
        | "confirmado"
        | "em_atendimento"
        | "concluido"
        | "cancelado"
        | "faltou"
      status_cupom: "pendente" | "ativo" | "aceito" | "expirado" | "cancelado"
      status_depoimento: "pendente" | "aprovado" | "recusado"
      status_documento: "pendente" | "assinado" | "recusado" | "revogado"
      status_lancamento:
        | "pendente"
        | "pago_parcial"
        | "pago"
        | "cancelado"
        | "atrasado"
      status_lead: "novo" | "publicado"
      status_lead_sala_vip: "novo" | "contatado" | "aprovado" | "recusado"
      status_orcamento:
        | "rascunho"
        | "enviado"
        | "aprovado"
        | "recusado"
        | "expirado"
      status_sala_vip: "pendente" | "aprovada" | "rejeitada"
      tipo_clinica: "medica" | "estetica" | "odontologica" | "terapias"
      tipo_comissao: "percentual" | "valor_fixo"
      tipo_consulta: "consulta" | "retorno" | "exame" | "procedimento"
      tipo_conta_bancaria:
        | "conta_corrente"
        | "cartao_credito"
        | "comissao"
        | "caixa"
        | "outro"
      tipo_convenio: "plano_saude" | "particular" | "sus" | "outros"
      tipo_desconto: "percentual" | "valor"
      tipo_documento:
        | "tcle"
        | "uso_imagem"
        | "atestado"
        | "solicitacao"
        | "declaracao"
        | "outro"
      tipo_intervalo: "fixo" | "pontual"
      tipo_lancamento: "receita" | "despesa"
      tipo_movimentacao_conta: "entrada" | "saida"
      tipo_movimentacao_estoque: "saldo_inicial" | "entrada" | "saida"
      tipo_valor_preco: "fixo" | "a_partir_de" | "gratuito"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      classificacao_item_estoque: [
        "material_consumo",
        "medicamento",
        "equipamento",
        "limpeza",
        "descartavel",
        "produto_venda",
        "outros",
      ],
      forma_pagamento: [
        "dinheiro",
        "cartao_debito",
        "cartao_credito",
        "pix",
        "transferencia",
        "boleto",
        "convenio",
        "outro",
      ],
      origem_depoimento: ["manual", "solicitado", "google", "whatsapp"],
      origem_lead: ["cupom", "lista_vip", "marketplace"],
      papel_clinica: [
        "proprietario",
        "gerente",
        "recepcionista",
        "assistente",
        "profissional",
      ],
      sexo: ["masculino", "feminino", "outro"],
      status_anamnese: ["pendente", "preenchido"],
      status_assinatura: ["ativa", "pausada", "cancelada"],
      status_campanha: ["draft", "agendada", "ativa", "pausada", "finalizada"],
      status_comissao: ["pendente", "paga", "cancelada"],
      status_consulta: [
        "agendado",
        "confirmado",
        "em_atendimento",
        "concluido",
        "cancelado",
        "faltou",
      ],
      status_cupom: ["pendente", "ativo", "aceito", "expirado", "cancelado"],
      status_depoimento: ["pendente", "aprovado", "recusado"],
      status_documento: ["pendente", "assinado", "recusado", "revogado"],
      status_lancamento: [
        "pendente",
        "pago_parcial",
        "pago",
        "cancelado",
        "atrasado",
      ],
      status_lead: ["novo", "publicado"],
      status_lead_sala_vip: ["novo", "contatado", "aprovado", "recusado"],
      status_orcamento: [
        "rascunho",
        "enviado",
        "aprovado",
        "recusado",
        "expirado",
      ],
      status_sala_vip: ["pendente", "aprovada", "rejeitada"],
      tipo_clinica: ["medica", "estetica", "odontologica", "terapias"],
      tipo_comissao: ["percentual", "valor_fixo"],
      tipo_consulta: ["consulta", "retorno", "exame", "procedimento"],
      tipo_conta_bancaria: [
        "conta_corrente",
        "cartao_credito",
        "comissao",
        "caixa",
        "outro",
      ],
      tipo_convenio: ["plano_saude", "particular", "sus", "outros"],
      tipo_desconto: ["percentual", "valor"],
      tipo_documento: [
        "tcle",
        "uso_imagem",
        "atestado",
        "solicitacao",
        "declaracao",
        "outro",
      ],
      tipo_intervalo: ["fixo", "pontual"],
      tipo_lancamento: ["receita", "despesa"],
      tipo_movimentacao_conta: ["entrada", "saida"],
      tipo_movimentacao_estoque: ["saldo_inicial", "entrada", "saida"],
      tipo_valor_preco: ["fixo", "a_partir_de", "gratuito"],
    },
  },
} as const

