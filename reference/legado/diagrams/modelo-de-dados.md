# Diagrama — Modelo de dados (principais entidades)

Simplificado a partir de `assets/mysql/dump.sql` e dos mapeamentos Doctrine.
Tabelas pivô `*_has_*` representadas como relações N:N.

```mermaid
erDiagram
    user ||--o{ user_has_role : tem
    role ||--o{ user_has_role : atribui
    user ||--o| profissional : identidade
    user ||--o| usuario : identidade
    user ||--o| cliente : identidade

    clinica ||--o{ agenda : possui
    clinica }o--o{ profissional : "clinica_has_profissional"
    clinica }o--o{ usuario : "clinica_has_usuario"
    clinica }o--o{ cliente : "clinica_has_cliente"
    clinica }o--o{ especialidade : "clinica_has_especialidade"
    clinica ||--o| endereco : tem
    clinica }o--o{ servico : "clinica_has_servico"

    especialidade }o--|| segmento : pertence

    profissional }o--o{ servico : "profissional_has_servico"
    profissional ||--o{ profissional_has_intervalo : disponibilidade

    agenda }o--o{ servico : "agenda_has_servico"
    agenda }o--|| cliente : para
    agenda }o--|| profissional : com

    servico }o--|| servico_categoria : categoria
    servico }o--o{ material : "servico_material"
    material }o--|| grupo_material : grupo
    tabela_preco }o--o{ servico : "tabela_has_servico"

    orcamento ||--o{ orcamento_servico : itens
    orcamento ||--o| venda : converte
    venda ||--o{ venda_has_pagamento : pagamentos
    venda }o--o{ agenda : "venda_has_agenda"
    venda }o--o{ venda_categoria : "venda_has_categoria"
    financeiro }o--|| financeirocategoria : categoria

    cliente ||--o{ cliente_ficha_anamnese : prontuario
```

> **Divergência conhecida**: a entidade `ClientesStatusEntity` referencia a
> tabela `clinica_cliente_status`, **ausente do dump** (existe apenas
> `clinica_has_cliente`). Ver `docs/04` e `docs/09` (R10). Não incluída acima por
> não existir no schema versionado.
