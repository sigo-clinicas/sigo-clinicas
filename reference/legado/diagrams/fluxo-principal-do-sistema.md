# Diagrama — Fluxo principal (agendamento e funil comercial)

## A) Paciente agenda online (B2C, via www)

```mermaid
sequenceDiagram
    participant P as Paciente
    participant WWW as sigo-clinicas-www
    participant API as sigo-clinicas-api
    participant DB as MySQL
    participant SES as Amazon SES

    P->>WWW: busca por especialidade + cidade
    WWW->>API: GET /clinicas?query[...] , /especialidades
    API-->>WWW: clínicas + profissionais + serviços
    P->>WWW: escolhe horário
    alt sem token
        WWW->>API: POST /oauth (login) ou POST /clientes (cadastro)
    end
    WWW->>API: POST /clinicas/:clinica/agendas (Bearer)
    API->>DB: cria agenda
    API->>SES: e-mail de confirmação (cliente + clínica)
    API-->>WWW: 201 agenda criada
```

## B) Funil B2B na clínica (via painel)

```mermaid
graph LR
    A["Agenda<br/>/agendas"] --> O["Orçamento<br/>/orcamentos (+servicos)"]
    O --> V["Venda<br/>/vendas"]
    V --> PG["Pagamentos<br/>/venda-pagamentos"]
    PG --> FIN["Financeiro<br/>/financeiros<br/>(pagar/receber)"]
    FIN --> REL["Relatórios/Controles<br/>vendas · procedimentos<br/>comissionamento"]
    A -.-> ANM["Ficha de anamnese<br/>/fichas-anamnese"]
```

## C) Lembrete de agendamento (job de console)

```mermaid
sequenceDiagram
    participant CRON as Cron (INFERIDO)
    participant CLI as Console 'agendamento'
    participant DB as MySQL
    participant SES as Amazon SES
    CRON->>CLI: php public/index.php agendamento
    CLI->>DB: getAgendamentosProximas24hs()
    DB-->>CLI: agendas confirmadas/aguardando/encaixe
    CLI->>SES: e-mail de lembrete (client.phtml / clinic.phtml)
```
