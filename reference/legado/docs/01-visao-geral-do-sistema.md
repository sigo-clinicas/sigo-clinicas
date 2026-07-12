# 01 — Visão geral do sistema

Convenção: **[FATO]** = confirmado no código (com arquivo). **[INFERÊNCIA]** =
dedução fundamentada. **[HIPÓTESE]** = plausível, pouca evidência.
**[NÃO ENCONTRADO]** = ausência que vale registrar.

## 1. Objetivo do produto

**[INFERÊNCIA forte]** O **Sigo Clínicas** é um **SaaS de gestão para clínicas**
(saúde/estética) combinado com um **marketplace público de agendamento**. Ele
tem dois lados:

- **B2B (a clínica paga e opera)** — um ERP/CRM completo no `painel`:
  agenda de profissionais, prontuário/ficha de anamnese, catálogo de serviços e
  materiais, tabelas de preço, orçamentos que viram vendas, contas a pagar/
  receber (financeiro), comissionamento e relatórios.
- **B2C (o paciente/cliente encontra e agenda)** — o site público `www`:
  busca de clínicas por especialidade e cidade, página da clínica com
  profissionais e serviços, e agendamento online exigindo cadastro/login.

**[FATO]** A natureza "saúde" está no domínio: 66 **especialidades médicas**
semeadas no banco (`sigo-clinicas-api/assets/mysql/dump.sql:171-238`), entidades
`FichaAnamnese` (prontuário), `Especialidade → Segmento`, e o texto da landing
"Encontre e agende o serviço de saúde mais perto de você"
(`sigo-clinicas-www/pages/landing/index.js`).

**[FATO]** O modelo é **multi-tenant por clínica**: praticamente toda rota da API
é prefixada por `/clinicas/:clinica/...`
(`sigo-clinicas-api/module/Clinica/config/module.config.php`), e o painel
força o usuário a estar vinculado a uma clínica no login
(`sigo-clinicas-painel/src/store/ducks/app.js:115-121`).

## 2. Principais módulos funcionais

Confirmados pelas rotas da API e pelo menu do painel:

- **Agenda / Agendamento** — `Agendas`, `AgendaServicos`, intervalos do
  profissional; e-mail de confirmação ao cliente e à clínica.
- **Clínicas** — cadastro, fotos (S3), serviços oferecidos, usuários, categorias.
- **Profissionais** — vínculo com clínica, serviços que executa, intervalos de
  atendimento, foto.
- **Clientes / Pacientes** — auto-cadastro público, perfil, ficha de anamnese.
- **Serviços & Materiais** — catálogo, categorias, grupos de materiais,
  materiais por serviço.
- **Tabelas de Preço** — preços por serviço.
- **Orçamentos → Vendas → Financeiro** — orçamento com serviços, conversão em
  venda, pagamentos, contas a pagar/receber, categorias financeiras.
- **Relatórios / Controles** — vendas, procedimentos, comissionamento.
- **Autenticação & Senhas** — OAuth2, criar-senha e recuperar-senha por e-mail.

## 3. Perfis de usuário (papéis)

**[FATO]** 8 papéis semeados no banco (`dump.sql:48-56`) e usados na ACL da API
(`sigo-clinicas-api/module/Application/src/Listener/AuthorizationListener.php`)
e no CASL do painel (`sigo-clinicas-painel/src/services/casl/index.js:3-11`):

`guest` (público), `admin`, `proprietario`, `gerente`, `recepcionista`,
`assistente`, `profissional`, `cliente`.

- **admin/proprietario/gerente** → CRUD amplo na clínica.
- **profissional** → leitura ampla + escrita em fichas/agendas/orçamentos.
- **assistente/recepcionista** → operação de agenda/vendas/orçamentos.
- **cliente** → o próprio cadastro, seus agendamentos, leitura de catálogo.
- **guest** → auto-cadastro, criar/recuperar senha, contato, e leituras
  públicas do marketplace.

## 4. Jornadas principais (ponta a ponta)

1. **Paciente agenda online** (`www`): busca clínica → vê profissionais/serviços
   → faz login/cadastro (OAuth2 password grant) → `POST /clinicas/:id/agendas` →
   a API dispara e-mail de confirmação (SES) ao cliente e à clínica.
2. **Clínica opera o dia** (`painel`): login → redireciona para `/Painel/Agenda`
   → recepção agenda/confirma, profissional preenche anamnese, gera orçamento →
   converte em venda → registra pagamento → aparece no financeiro/relatórios.
3. **Captação de clínica** (`www` landing): formulário "Divulgue sua Clínica" →
   `POST /contato` → e-mail para a equipe comercial.
4. **Fluxo de senha**: `POST /recuperar-senha` gera token e envia e-mail →
   `PATCH /recuperar-senha/:token` (ou `/criar-senha/:token`) define a senha.

Detalhamento com arquivos/linhas em `docs/03-fluxos-de-dados.md`.

## 5. Fronteiras dos serviços

**[FATO]** Arquitetura **"API central + múltiplos frontends"**, não microsserviços:

- **Um único backend** (`sigo-clinicas-api`) concentra toda a lógica de negócio,
  o banco MySQL, a autenticação OAuth2, os uploads (S3) e o envio de e-mail (SES).
- **Três clientes** consomem essa API por HTTP/REST: o painel (SPA React), o site
  (Next.js SSR) e — em teoria — o app Flutter (que na prática **não** integra
  com a API real; ver §7).
- Não há gateway, fila, worker de mensageria, GraphQL ou gRPC. O único
  processamento fora do request HTTP é **um comando de console** de notificação
  (projetado para cron), sem scheduler versionado.

## 6. Tecnologias (resumo)

| Camada | Tecnologia [FATO] |
|---|---|
| Backend | PHP 7.3, Zend Framework 3 / Apigility, Doctrine ORM, JMS Serializer, HAL/JSON |
| Auth | OAuth2 (api-skeletons/zf-oauth2-doctrine-permissions-acl), Bearer token, ACL por papel |
| Banco | MySQL (5.6 no compose dev; RDS em prod), schema `sigoclinicas` |
| Painel | React 16, Create React App 1 (Webpack 3), Redux + redux-saga, Ant Design 3 + Material-UI 4, CASL |
| Site | Next.js 7 (target serverless, servidor custom), React 16, Ant Design 3, Redux/Saga, styled-components |
| App | Flutter (beta, Dart <3), MobX + Provider, Dio (**não conectado à API real**) |
| Infra | AWS: ECS (API), S3 + CloudFront (painel e site estáticos), ECR, SES, RDS, Route53, ACM; CloudFormation; GitLab CI |
| Integrações externas | AWS S3 (uploads), Amazon SES (e-mail), Google Calendar API (painel), ViaCEP (endereço) |

## 7. Arquitetura geral (mapa mental)

```
                    Paciente (browser)        Equipe da clínica (browser)
                          │                          │
                   sigo-clinicas-www          sigo-clinicas-painel
                   (Next.js SSR, S3+CF)        (React SPA, S3+CF)
                          │                          │
                          └──────── HTTPS/REST ──────┘
                                     │  OAuth2 Bearer
                                     ▼
                          sigo-clinicas-api  (ECS / Docker)
                          Zend Apigility + Doctrine
                          ┌──────────┼──────────┬───────────┐
                          ▼          ▼          ▼           ▼
                      MySQL/RDS   Amazon S3   Amazon SES   (console cron
                     schema        uploads    e-mails       de notificação)
                    sigoclinicas
```

O app Flutter (`sigo-clinicas-app`) **está desenhado para ser um quarto cliente,
mas não foi implementado** — hoje aponta para `jsonplaceholder.typicode.com` e
tem login falso (`lib/stores/form/form_store.dart:119-133`). Ver `02` e `09`.

## 8. O que é fato, inferência e o que não foi encontrado

**Fatos centrais**: a existência e o papel de cada repositório; a stack; o modelo
multi-tenant; os 8 papéis; o fluxo OAuth2; as integrações S3/SES/Google
Calendar/ViaCEP; a duplicação bedin↔sigo.

**Inferências fortes**: o produto ser um SaaS de gestão + marketplace de saúde;
o app ser abandonado; o "bedin/HairBe" ser white-label de estética; o comando de
notificação rodar por cron.

**[NÃO ENCONTRADO]**:
- Gateway de pagamento (pagamentos são apenas **registrados** como dados, sem
  Stripe/PagSeguro/Cielo no código).
- Push notifications reais (sem FCM/APNS/SNS; "notificações" são e-mails).
- Testes de domínio, migrations Doctrine, observabilidade (APM/tracing).
- Qualquer definição de agendador (cron/EventBridge) para o comando de console.
- A string "Seguro Clínicas" (o produto se chama "Sigo Clínicas").
