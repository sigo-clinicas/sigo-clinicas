# 10 — Glossário

Termos, entidades, módulos, papéis, tabelas e serviços do Sigo Clínicas.

## Produto e marcas
- **Sigo Clínicas / SigoClínicas** — nome do produto no código (org GitLab
  `sigo-clinicas`). O usuário chamou de "Seguro Clínicas"; a string real é "Sigo".
- **HairBe** — marca exibida na instância white-label `bedin-www` (vertical
  estética/beleza). Injetada em títulos e termos de uso.
- **bedin** — nome dos repositórios da instância white-label; **não** aparece
  dentro de nenhum arquivo.
- **addpix** — nome do usuário/cliente OAuth2 semente no dump e domínio remetente
  de e-mails (`contato@addpix.com.br`); **[INFERÊNCIA]** empresa/fornecedor
  original.

## Repositórios
- **sigo-clinicas-api** — backend/API central (PHP/Apigility).
- **sigo-clinicas-painel** — ERP/CRM da clínica (React SPA).
- **sigo-clinicas-www** — site público/marketplace (Next.js).
- **sigo-clinicas-app** — app Flutter (boilerplate abandonado).
- **bedin-api/painel/www** — cópias/fork white-label.

## Tecnologias
- **Apigility** (hoje Laminas API Tools) — framework REST sobre Zend Framework 3.
- **Doctrine ORM** — mapeamento objeto-relacional (aqui via YAML `*.dcm.yml`).
- **HAL** (Hypertext Application Language) — formato das respostas
  (`_embedded.data`, `_links`).
- **OAuth2 password grant** — fluxo de login usado pelos frontends.
- **CASL** — biblioteca de autorização client-side usada no painel.
- **Redux / redux-saga / reduxsauce (ducks)** — estado dos frontends web.
- **MobX / Provider** — estado do app Flutter (boilerplate).
- **ViaCEP** — serviço de autocompletar endereço por CEP.
- **Amazon SES / S3 / ECS / ECR / CloudFront / Route53 / RDS** — serviços AWS.

## Papéis (roles)
- **guest** — público não autenticado.
- **admin** — administrador global.
- **proprietario** — dono da clínica.
- **gerente** — gestão da clínica.
- **recepcionista** — operação de agenda/recepção.
- **assistente** — apoio operacional.
- **profissional** — presta o serviço; preenche anamnese.
- **cliente** — paciente/consumidor final.

## Entidades / tabelas de domínio
- **clinica** — o tenant central (multi-tenant por clínica).
- **profissional / usuario / cliente** — pessoas; cada uma OneToOne com **user**
  (identidade OAuth2). `usuario` = staff administrativo.
- **user / role / user_has_role** — identidade e papéis (auth).
- **oauth2_*** — tabelas do servidor OAuth2 (accesstoken, refreshtoken, client,
  scope, authorizationcode, jwt, jti, publickey + pivôs `*_to_scope`).
- **endereco / telefone** — cadastros base reutilizáveis (via `*_has_telefone`).
- **agenda / agenda_has_servico** — agendamentos e serviços do agendamento.
- **servico / servico_categoria / servico_material / material / grupo_material**
  — catálogo de serviços e insumos.
- **tabela_preco / tabela_has_servico** — preços por serviço.
- **especialidade / segmento** — taxonomia (especialidade pertence a um segmento).
- **ficha_anamnese / cliente_ficha_anamnese** — prontuário do paciente.
- **orcamento / orcamento_servico / orcamento_has_servico** — orçamentos.
- **venda / venda_has_agenda / venda_has_pagamento / venda_categoria /
  venda_has_categoria** — vendas e pagamentos.
- **financeiro / financeirocategoria** — contas a pagar/receber.
- **clinica_cliente_status** — mapeada no ORM mas **ausente do dump** (ver `04`/`09`).

## Conceitos de arquitetura
- **Multi-tenant por clínica** — quase toda rota é `/clinicas/:clinica/...`; o
  isolamento é aplicacional (`AuthenticationListener`).
- **AuthenticationListener / AuthorizationListener** — listeners da API que
  garantem, respectivamente, acesso à clínica e permissão por papel/método.
- **API Problem** — formato de erro (`application/problem+json`).
- **White-label** — reembalar o mesmo sistema sob outra marca (bedin/HairBe).
- **Job de console `agendamento`** — único processamento fora do request HTTP;
  envia e-mails de lembrete das próximas 24h (projetado para cron).

## Serviços/integrações externas
- **S3** — armazenamento de uploads (fotos de clínica, anexos de anamnese).
- **SES** — envio de e-mails transacionais (agendamento, contato, senha).
- **Google Calendar API** — espelhamento opcional de agenda (só no painel).
- **jsonplaceholder.typicode.com** — API de demonstração usada (apenas) pelo app
  Flutter abandonado.

## Filas / eventos
- **[NÃO ENCONTRADO]** — não há SQS/SNS/RabbitMQ/Kafka/Redis queue, tópicos,
  webhooks ou workers. Registro aqui para deixar explícita a ausência.
