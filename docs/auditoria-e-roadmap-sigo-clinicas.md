# Sigo Clínicas — Auditoria Consolidada & Roadmap de Entrega

**Dizevolv · Projeto Sigo Clínicas (Katia Loncarcci)**
Data: 11/07/2026 · Contrato assinado em 11/06/2026 · Prazo contratual: 90 dias → **deadline 09/09/2026** · **Restam ~60 dias**

---

## 1. Sumário executivo

O projeto consiste em **unificar dois sistemas** em um produto único, seguro e escalável:

1. **Sistema legado (2022)** — 3 componentes funcionais em produção (API PHP/Apigility, painel React 16, marketplace Next.js 7), multi-tenant real, mas com stack inteira em fim de vida, segredos vazados no repositório e zero cobertura de testes. **Não deve ser evoluído — serve como fonte de regras de negócio e do modelo multi-tenant/marketplace.**
2. **Protótipo Base44 (2026)** — interface moderna (React + Vite + Tailwind/shadcn) validada pela cliente, com 32 entidades e 32 páginas cobrindo prontuário, financeiro, estoque, marketing e white-label. **Serve como referência visual e funcional (pixel parity), mas o backend é o BaaS proprietário do Base44 e o modelo de dados é essencialmente single-tenant e desnormalizado — precisa ser reconstruído em banco próprio.**

**Conclusão central da auditoria:** nenhum dos dois códigos é aproveitável como base de execução. A estratégia correta (e já contratada) é: **UI do Base44 como espec visual + regras de negócio do legado + banco de dados novo, relacional e multi-tenant desde o dia 1.** O maior risco técnico do projeto não está em nenhuma feature isolada — está no **modelo de dados multi-tenant + RBAC no servidor**, que não existe no Base44 e é a fundação de todo o resto. Por isso ele é tratado como *etapa limitante estrutural*, ao lado da etapa limitante declarada pela cliente (agenda + landing de agendamento + prontuário unificado).

**Decisões já homologadas na call de 02/07** que destravam a execução: banco pode ser **zerado** (sem migração de dados), **especialidades viram cadastro dinâmico N:N com multisseleção** editável pelo admin, e a cliente **não vai mais alterar o Base44** (referência congelada). Acessos ao Base44 e ao GitLab já concedidos (Neemias).

---

## 2. Insumos analisados (rastreabilidade)

| Insumo | Conteúdo | Status |
|---|---|---|
| Transcrição call 02/07 (ZipCall) | Kickoff, decisões, etapa limitante, acessos | ✅ Analisado |
| Escopo contratual (checklist 7 módulos) | Objeto do contrato, prazo 90 dias | ✅ Analisado |
| Auditoria técnica do legado (v1 e v2) + docs 00–10 + 6 diagramas | 7 repositórios, riscos R1–R17 | ✅ Analisado |
| 8 XMLs do pacote de contexto + 9 CSVs de inventário + relatório de segredos | 4.054 arquivos, 39 segredos redigidos, reconciliação validada | ✅ Analisado |
| **repomix-sigo-clinicas-base44.xml** | **183 arquivos: 32 entidades, 32 páginas, 1 function Deno** | ✅ **Analisado nesta auditoria (inédito)** |

---

## 3. Auditoria — Sistema legado (síntese e o que ele fornece ao projeto)

A auditoria do legado já está madura (R1–R17). Consolidação do que importa para a execução:

**O que o legado FORNECE (fonte de regras de negócio):**
- **Modelo multi-tenant por clínica** (`/clinicas/:clinica/...`, isolamento no `AuthenticationListener`) — referência para o novo modelo de dados.
- **RBAC com 8 papéis** (guest, admin, proprietario, gerente, recepcionista, assistente, profissional, cliente) e matriz papel×recurso×método no `AuthorizationListener` — referência para as políticas do novo backend.
- **Marketplace público real**: busca por especialidade + cidade, página da clínica, agendamento com login, e-mails de confirmação — o "coração" citado pela Katia já existiu aqui e é a referência funcional do B2C.
- **Taxonomia especialidade → segmento** (66 especialidades semeadas) — base para o novo cadastro dinâmico N:N.
- Funil comercial completo: agenda → anamnese → orçamento → venda → pagamento → financeiro → relatórios/comissões.
- **18 coleções Postman** — o contrato de API mais próximo de uma spec; útil para validar paridade de regras.

**O que o legado NÃO fornece e por quê:**
- Código executável seguro: PHP 7.3/Zend/Apigility/MySQL 5.6/Next 7/React 16 — tudo EOL (R3).
- App mobile: o repo Flutter é boilerplate abandonado (aponta para jsonplaceholder). **Qualquer app parte do zero.**
- Infra confiável: segredos AWS/SES hardcoded (R1), credenciais semente `addpix` (R2), CORS `*` (R4), zero testes (R12).

**Ações de segurança independentes do desenvolvimento (recomendar à cliente já):**
1. **Rotacionar credenciais AWS/SES** expostas no Dockerfile/docker-compose (valem para as 4 cópias sigo/bedin) e auditar uso na conta AWS `304789899667`.
2. Verificar se a infra legada (ECS/RDS/S3/CloudFront) **ainda está de pé e gerando custo** — se o produto será substituído, planejar desligamento/backup.
3. A limpeza de membros do GitLab feita na call de 02/07 (mantidos apenas Alex + Neemias) já mitigou parte do risco de acesso. ✔

---

## 4. Auditoria — Protótipo Base44 (análise inédita do repomix)

**Stack:** React 18 + Vite + Tailwind + shadcn/Radix + TanStack Query + `@base44/sdk`. Backend = BaaS Base44 (entidades JSONC, 1 function Deno `anamnesePublica` com service role, integrações `SendEmail` e `UploadFile`). Frontend moderno e de alta qualidade visual — **excelente como referência de pixel parity**; backend integralmente descartável/substituível, conforme contrato.

**Cobertura funcional (o que a cliente já validou visualmente):**

| Área | Páginas/Componentes | Entidades |
|---|---|---|
| Agenda | Agenda (dia/semana/mês, filtro por profissional = multiagenda), ConsultaModal, venda de produto no atendimento | Consulta, Profissional |
| Prontuário | Resumo, Avaliação Clínica, Evolução (com insumos utilizados, prescrição, fotos), Receituário, Galeria antes/depois, Documentos/consentimento, **Odontograma e Mapa de Estética** (diferenciais) | AvaliacaoClinica, EvolucaoSessao, DocumentoConsentimento |
| Anamnese | Formulários configuráveis + **preenchimento público por link/token sem login** (function `anamnesePublica`) | FormularioAnamnese, RespostaAnamnese |
| Orçamentos | **Kanban (rascunho→enviado→aprovado/recusado) com botão Vender** que lança no financeiro, faturamento | Orcamento |
| Financeiro | Fluxo de caixa, Contas bancárias + detalhe, Conciliação manual, Centro de custo, Categorias, Comissões, Cobranças, Pagamento rápido | LancamentoFinanceiro, ContaBancaria, MovimentacaoConta, CentroCusto, CategoriaLancamento |
| Convênios | Cadastro + **fechamento de guia via upload de CSV** | Convenio, TabelaPreco, ItemTabelaPreco |
| Estoque | Itens, entrada com lote/validade/preço, saída, rastreabilidade de lotes, relatórios | ItemEstoque, MovimentacaoEstoque, ComposicaoServico |
| Marketing | Cupons, Campanhas (filtros demográficos/temporais, canais e-mail/SMS/WhatsApp), Depoimentos, **Sala VIP** (Clube), Leads | Cupom, Campanha, Depoimento, SalaVIP, Lead, LeadSalaVIP |
| Plataforma | Landing page pública, Portal de agendamento, Planos de assinatura (limites por papel), Gestão de usuários | Clinica, PlanoAssinatura, AssinaturaClinica, User |
| White-label | Configurações com **troca de tipo de clínica** (médica/estética/odonto/terapias) alterando terminologia (ClinicaContext) e tema | Clinica |

### Achados críticos do Base44 (o que NÃO pode ser copiado como está)

**A1 — 🔴 Modelo single-tenant.** Das 32 entidades, apenas 6 têm `clinica_id` (Cupom, Depoimento, Lead, LeadSalaVIP, SalaVIP, AssinaturaClinica — justamente as de marketplace). **Paciente, Consulta, Profissional, Orçamento, Financeiro, Estoque, Anamnese — nada tem vínculo com clínica.** O protótipo funciona como o sistema de UMA clínica; o produto contratado é uma plataforma multi-clínica com marketplace. Isso confirma a decisão da call: **banco do zero, com `clinica_id` (tenant) em todas as tabelas operacionais desde a primeira migration.**

**A2 — 🔴 Permissões inexistentes no servidor.** A entidade `User` só tem enum `admin|user`; o código de UI referencia papéis (admin, gestor, recepcionista, profissional, paciente) sem enforcement. O legado prova o padrão correto (ACL 100% no backend). O novo backend precisa de RBAC servidor-side desde o início — nada de repetir o erro do painel legado (CASL em localStorage como "segurança").

**A3 — 🟠 Desnormalização massiva.** Padrão Base44: nomes copiados em todas as entidades (`paciente_nome`, `profissional_nome`, `clinica_nome`, `convenio_nome`...). Na reconstrução, isso vira **chaves estrangeiras reais** — os campos `*_nome` são artefato do BaaS, não regra de negócio.

**A4 — 🟠 Duplicações e inconsistências de modelo.**
- `Servico` × `Procedimento` são duas entidades para o mesmo conceito (Procedimento tem `valor_particular` + `convenios_valores`; Servico é usado na composição/landing). **Consolidar em um único cadastro de Serviço** com preços via tabela de preço (como no legado).
- `Consulta` tem `servicos[]` E `servico_id/servico_nome` simultaneamente (evolução incremental do vibe-coding). Normalizar para N:N (`agenda_has_servico`, como no legado).
- `MeusPupons.jsx` é cópia byte a byte de `MeusCupons.jsx` (typo) — descartar.
- `especialidade` é **string livre** em Profissional/Servico/Procedimento → substituir pelo cadastro dinâmico decidido na call: **Tipo de estabelecimento (segmento) → Especialidades (N:N com clínica e com profissional, multisseleção, editável pelo admin)**. O legado já tinha `especialidade → segmento`; é a mesma modelagem, agora exposta na UI.

**A5 — 🟠 Campanhas sem motor de disparo.** A página de Campanhas modela filtros e canais (e-mail/SMS/WhatsApp), mas **não há nenhuma integração real** (nenhuma function, nenhum provider). Compatível com o escopo (disparo WhatsApp = cobrança à parte, AD) — na F1 entrega-se o CRUD/segmentação; o disparo real depende de decisão comercial (provider: Meta Cloud API, Z-API, Evolution etc.).

**A6 — 🟡 Confirmações do escopo no código.** A aba **Cobranças existe** (`financeiro/Cobrancas.jsx`) e está marcada no contrato para **remoção** (validado pela cliente). A **Conciliação** lê `ContaBancaria` + `MovimentacaoConta` — o bug relatado ("não puxa dados") é coerente com lançamentos que não geram `MovimentacaoConta`; na reconstrução, movimentação de conta passa a ser gerada transacionalmente pelo backend a cada baixa de lançamento.

**A7 — 🟡 Portal público raso.** `PortalAgendamento` e `LandingPage` operam sobre a clínica única (sem busca de clínicas, sem cidade/especialidade). O marketplace do produto final (captação global de pacientes, clínicas em destaque, ranqueamento) deve tomar o **legado `www` como referência funcional** e o Base44 como referência visual.

**A8 — 🟡 Dependências do BaaS a substituir.** `anamnesePublica` (Deno + service role) → endpoint público próprio com token; `SendEmail` → provedor transacional próprio (SES/Resend); `UploadFile` → storage próprio (S3). Auth do Base44 → auth própria com RBAC.

---

## 5. De-para: Escopo contratual × Base44 × Legado

Legenda: ✅ existe/aproveitável como referência · 🟨 parcial · ❌ inexistente · 🔧 refazer no novo backend (sempre verdadeiro para a camada de dados)

| Item do escopo | Base44 (UI ref.) | Legado (regra ref.) | Observação de execução |
|---|---|---|---|
| **M1** Agenda/multiagenda | ✅ Agenda + filtro prof. | ✅ agendas + intervalos | Unir: visões do Base44 + intervalos de disponibilidade do legado |
| M1 Landing pública + agendamento online | 🟨 single-clinic | ✅ marketplace completo | Marketplace multi-clínica; visual Base44 |
| M1 Cadastro pacientes/clientes | ✅ | ✅ | Cadastro **global** na plataforma (M3) muda o modelo: paciente é da plataforma, vínculo N:N com clínicas |
| M1 Orçamento + kanban + botão Vender | ✅ completo | ✅ orcamento→venda | Base44 é a referência principal |
| M1 Serviços (exibir/não na pág. pública) | 🟨 sem flag público | ✅ clinica_has_servico | Adicionar flag; consolidar Servico×Procedimento (A4) |
| M1 Tabelas de preço (SUS/convênio/particular) | ✅ TabelaPreco+Itens | ✅ tabela_preco | — |
| M1 Financeiro pagar/receber (**substituir pelo do Base44**) | ✅ completo | 🟨 simples | Contrato manda usar o modelo Base44 ✔ |
| M1 Confirmação de recebimento | ✅ pagamentos parciais/baixa | 🟨 | Modelo Base44 ✔ |
| M1 Relatórios/dashboards (**aprimorar**) | 🟨 Relatorios.jsx | 🟨 controles | Dizevolv aprimora — definir KPIs na homologação |
| **M2** Prontuário (resumo, avaliação, anamnese, evolução, receituário, fotos, anexos) | ✅ **muito completo** (+ odontograma/mapa estética) | 🟨 ficha_anamnese | Base44 é a espec; decidir com Katia: unificar Anamnese+Avaliação? |
| M2 Anamnese configurável + link público sem login | ✅ (function + token) | ❌ | Reimplementar endpoint público próprio (A8) |
| M2 Evolução por voz/transcrição (sugestão Dizevolv) | ❌ | ❌ | Novo — pós-MVP dentro da F1 se prazo permitir |
| M2 Rastreabilidade de insumos (link estoque) | ✅ insumos na evolução + lotes | ❌ | **Exige núcleo mínimo de estoque na F1** (ver §7) |
| **M3** Cupons | ✅ | ❌ | — |
| M3 Lead nome+telefone sem login | ✅ Lead | 🟨 contato | — |
| M3 Cadastro global do paciente | ❌ (single-tenant) | 🟨 cliente global c/ vínculo | Modelagem nova (A1) |
| M3 Clube/Sala VIP | ✅ | ❌ | — |
| M3 Destaques (clínica/prof./serviço) + ranqueamento | 🟨 Depoimentos c/ nota e destaque | ❌ | Monetização do destaque: **AD — decisão pendente da Katia** |
| M3 Campanhas WhatsApp | 🟨 UI/filtros sem disparo | ❌ | Disparo = **AD/cobrança à parte**; F1 entrega segmentação |
| **M4** Estoque (completo) | ✅ prototipado | ❌ | Contrato sinaliza F2; call: sem prioridade da cliente → ver recomendação §7 |
| **M5** Remover aba Cobrança | (existe p/ remover) | — | Simplesmente não portar |
| M5 Conciliação corrigida | 🟨 bugada | ❌ | Corrigida por design no novo backend (A6) |
| M5 Conta bancária, categorias, centro de custo, conciliação manual | ✅ | 🟨 | Modelo Base44 ✔ |
| M5 Open Finance (sugestão) | ❌ | ❌ | F2 |
| **M6** Convênios + guia CSV + comissões | ✅ (CSV confirmado no código) | ✅ comissionamento | Contrato sinaliza F2; ver §7 |
| **M7** White-label (tipo de clínica → cor + nomenclatura) | ✅ ClinicaContext (4 tipos) | ❌ | Base44 é a espec ✔ |

**Leitura estratégica:** o Base44 cobre ~85% do escopo como espec visual/funcional. Os 3 blocos que **não têm referência pronta em lugar nenhum** e concentram o risco: (1) fundação multi-tenant + RBAC + paciente global; (2) marketplace multi-clínica com destaques/ranqueamento; (3) motor de campanhas (AD).

---

## 6. Decisões homologadas × pendências

**Homologado (call 02/07):**
- Banco de dados **do zero** (sem migração de dados legados).
- **Especialidades dinâmicas**: segmento (tipo de estabelecimento) → especialidades, N:N, multisseleção, CRUD pelo admin.
- Base44 **congelado** — cliente não altera mais; mudanças passam pelo fluxo entrega→homologação.
- Estoque/convênios: **sem prioridade da cliente — faseamento é decisão técnica da Dizevolv** (proposta no §7).
- Próxima reunião: **15/07 às 14h** (quinzenais; comunicação diária via WhatsApp).
- Conta Play Store existe (app já foi publicado); conta Apple criada mas **não validada** — resgatar.

**Pendente (levar para 15/07 e seguintes):**
1. Modelo de cobrança do **destaque** (clínicas/profissionais pagos na busca) — AD.
2. Unificar **Anamnese + Avaliação** no prontuário? (decisão da cliente, escopo M2).
3. Provider e comercial do **disparo WhatsApp** — AD, cobrança à parte.
4. KPIs prioritários dos **relatórios/dashboards** aprimorados.
5. Validação da conta **Apple Developer** (bloqueio futuro de publicação iOS, lead time longo — iniciar já).
6. Definição de **domínios/infra** do novo produto (o legado tem divergência `.com`/`.com.br`; conta AWS é a `addpix`?).
7. Recomendar formalmente a **rotação das credenciais** expostas no legado (§3).

---

## 7. Roadmap de desenvolvimento (60 dias restantes · 4 sprints quinzenais)

Premissas: sprints casados com as reuniões quinzenais de homologação; **etapa limitante da cliente** (agenda + landing de agendamento + prontuário) começa no Sprint 1 junto com a **etapa limitante estrutural** (fundação multi-tenant/RBAC); pixel parity com o Base44; nada do legado é removido sem aprovação.

### Sprint 0 — já em curso (02–14/07) · "Fundação decidida"
- ✔ Acessos (Base44 + GitLab), auditorias, este documento.
- **D0.1** Decisão de arquitetura alvo (backend + banco relacional escalável — ex.: PostgreSQL; API própria com auth/RBAC; storage S3; e-mail transacional). *Owner: Neemias.*
- **D0.2** Modelo de dados v1: todas as entidades do Base44 normalizadas + `clinica_id` universal + paciente global (vínculo N:N clínica↔paciente) + segmento/especialidade N:N + consolidação Servico×Procedimento. Migrations desde o commit 1.
- **D0.3** Repositório novo + CI com gate (lint/testes) + ambientes dev/homolog.
- **D0.4** Levar pendências do §6 à reunião de **15/07**.

### Sprint 1 (15–28/07) · "O coração começa a bater" → homologação 29/07*
- **D1.1 Fundação**: auth + RBAC servidor-side (papéis do legado como base: admin, proprietário, gerente, recepcionista, assistente, profissional, cliente), multi-tenancy aplicado em toda query, testes de isolamento entre clínicas (lição do R12).
- **D1.2 Cadastros-núcleo**: clínica (com tipo/white-label básico), profissionais (+ intervalos de disponibilidade), serviços unificados + tabelas de preço, especialidades dinâmicas (decisão da call).
- **D1.3 Agenda/multiagenda** funcional (visões dia/semana/mês, filtro por profissional) — pixel parity Base44.
- **Meta da demo:** primeira entrega "com questão visual consolidada" prometida na call.

### Sprint 2 (29/07–11/08) · "Gestão do paciente" → homologação 12/08*
- **D2.1 Paciente global** + vínculo com clínicas + perfil.
- **D2.2 Prontuário completo** (resumo, avaliação, evolução com insumos, receituário imprimível, galeria antes/depois, documentos/consentimento, odontograma/mapa estética conforme tipo de clínica).
- **D2.3 Anamnese configurável** + link público por token sem login (substituindo a function Base44).
- **D2.4 Estoque-núcleo (F1 mínimo)**: cadastro de itens + entrada com lote/validade + baixa — **necessário porque a rastreabilidade de insumos do prontuário (M2, F1) depende dele**. O restante do M4 (composição/markup, preset por procedimento, mapa de calor, bloqueio de saldo) fica para F2.
- **Resolve exatamente a dor central da Katia:** "agendei, atendi — cadê meu prontuário, receituário, exames, antes/depois".

### Sprint 3 (12–25/08) · "Dinheiro e captação" → homologação 26/08*
- **D3.1 Funil comercial**: orçamento em kanban com Vender → venda → pagamentos (parciais) → financeiro pagar/receber (modelo Base44; sem aba Cobrança).
- **D3.2 Financeiro completo**: contas bancárias, categorias, centro de custo, fluxo de caixa, conciliação manual **corrigida por design** (movimentação gerada transacionalmente).
- **D3.3 Marketplace/landing multi-clínica**: busca por segmento/especialidade/cidade, página da clínica, agendamento público, captação de lead (nome+telefone), cupons.
- **D3.4 Comissões** por profissional (percentual/fixo → contas a pagar) — antecipado do M6 por já estar prototipado no Base44 e depender só do funil do D3.1.

### Sprint 4 (26/08–08/09) · "Diferencial e fechamento" → **entrega F1: 09/09**
- **D4.1 White-label completo** (M7): troca de tipo de clínica → tema/cor + terminologia em toda a UI.
- **D4.2 Marketing**: Sala VIP/Clube, depoimentos com ranqueamento, destaques (estrutura pronta; monetização conforme AD), campanhas com segmentação (disparo = AD).
- **D4.3 Relatórios/dashboards aprimorados** (KPIs definidos com a cliente no Sprint 2/3).
- **D4.4 Convênios**: cadastro + fechamento de guia via CSV (referência pronta no Base44) — *se o prazo apertar, é o candidato natural a deslizar para F2 junto com o estoque avançado, com aval da cliente.*
- **D4.5 Hardening + homologação final**: testes dos fluxos críticos (RBAC, isolamento de tenant, cálculos financeiros — as três áreas sem cobertura que afundaram o legado), correções de homologação, documentação de deploy.

### Fase 2 (pós 09/09 — a repactuar)
Estoque avançado (composição/markup, presets, relatórios/mapa de calor, bloqueio de saldo) · Open Finance · disparo real de WhatsApp (AD) · monetização de destaque (AD) · evolução por voz/transcrição · app mobile (do zero — o Flutter legado não é reaproveitável; contas de loja já encaminhadas).

\* Datas de homologação a confirmar no calendário quinzenal (reunião fixa confirmada: 15/07 14h).

### Riscos do roadmap e mitigação

| Risco | Prob. | Mitigação |
|---|---|---|
| 60 dias para escopo F1 amplo | Alta | Etapas limitantes primeiro; D4.4 (convênios) como buffer negociável; comunicação de trade-offs a cada homologação |
| Retrabalho por mudança na referência Base44 | Baixa | Cliente confirmou congelamento; repomix atual = baseline versionada |
| Scope creep na homologação quinzenal | Média | Mudanças viram itens de backlog priorizados contra o prazo, registrados por escrito |
| Bloqueio Apple/Play para fase mobile | Média (F2) | Resgatar/validar conta Apple **agora** (lead time) |
| Regressões em RBAC/tenant/financeiro | Média | Testes automatizados obrigatórios nessas 3 áreas + gate de CI (anti-padrão do legado) |
| Infra/custos do legado ainda ativos | ? | Auditar conta AWS; rotacionar segredos; planejar sunset |

---

## 8. Ações imediatas (esta semana, antes de 15/07)

1. Fechar D0.1 (arquitetura) e D0.2 (modelo de dados v1) internamente.
2. Preparar pauta da reunião de 15/07 com as 7 pendências do §6.
3. Enviar à Katia a recomendação de rotação de credenciais do legado (independe do projeto, protege a cliente).
4. Iniciar resgate/validação da conta Apple Developer.
5. Confirmar baseline: tag/registro do repomix Base44 atual como referência congelada de pixel parity.
