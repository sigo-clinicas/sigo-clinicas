# CLAUDE.md — Sigo Clínicas (reconstrução Dizevolv)

> Fonte de verdade do projeto. Leia no início de toda sessão. Regras aqui têm
> precedência sobre suposições. As decisões técnicas estão FECHADAS pela liderança
> técnica; só itens marcados "PERGUNTA À CLIENTE" seguem abertos (reunião 15/07).

## 0. Missão

Reconstruir o **Sigo Clínicas** — SaaS de gestão para clínicas (médica, estética,
odontológica, terapias) + marketplace público de agendamento — como **uma
aplicação nova**, unificando dois sistemas já validados pela cliente:

1. **Protótipo Base44** (`reference/base44/`) → **referência de interface e UX**
   (pixel parity). React 18 + Vite + Tailwind + shadcn.
2. **Sistema legado 2022** (`reference/legado/` + `docs/auditoria-e-roadmap-sigo-clinicas.md`)
   → **referência de regras de negócio**: multi-tenant por clínica, RBAC de 8
   papéis, marketplace, funil comercial, comissões. Stack EOL — **não é
   reaproveitado como código**, apenas como especificação de comportamento.

**Princípio inegociável:** nada que a cliente validou pode ser perdido. Dados
começam do zero (homologado pela cliente). Regras, não.

## 1. Estratégia de reconstrução (ler antes de codar qualquer coisa)

- **Frontend:** portar os componentes/páginas do Base44 para Next.js (mesmo React;
  muda roteamento e data fetching), removendo o acoplamento ao `@base44/sdk`
  (base44Client, entities, auth, SendEmail, UploadFile) e plugando o acesso via
  Supabase pelo servidor. NÃO recriar telas que o Base44 já tem — a cliente as
  homologou. Trabalho real do front: (a) injetar tenant + permissões, (b) corrigir
  as inconsistências do §4, (c) construir as telas que o Base44 não tem
  (marketplace multi-clínica).
- **Backend:** mora nas **Server Actions / Route Handlers do Next.js**. É novo, mas
  **codifica regras já auditadas**. Fontes de verdade do comportamento: matriz de
  ACL e isolamento de tenant do legado (`AuthorizationListener`/
  `AuthenticationListener`) + as 18 coleções Postman do legado (checklist de
  paridade) + o comportamento das telas do Base44.
- **Banco:** PostgreSQL do Supabase, novo, **vazio**, multi-tenant desde a primeira
  migration, com **RLS por `clinica_id` obrigatório em toda tabela operacional**.
- **Garantia "sem perder nada":** o de-para do §5 do documento de auditoria é
  checklist vivo, revisto a cada homologação quinzenal. O que não couber no prazo é
  repactuado por escrito para a Fase 2 — nunca removido em silêncio.

## 2. Stack alvo (DECIDIDA — líder técnico)

- **Framework full-stack:** **Next.js (App Router) + TypeScript**. Um só projeto
  serve o marketplace público (SSR/SSG para SEO) e o painel autenticado —
  substitui os dois repos separados do legado (`www` + `painel`).
- **Plataforma de dados:** **Supabase** = PostgreSQL + Auth + Storage + Edge
  Functions. Região **sa-east-1 (São Paulo)** por LGPD e latência.
- **Deploy:** **Vercel** (Next), região `gru1`. Supabase Cloud para DB/Auth/Storage.
- **Arquitetura de acesso a dados — Opção B (DECIDIDA):**
  - CRUD autenticado normal → Server Actions/Route Handlers usando **client
    Supabase server-side ligado à sessão do usuário** (RLS aplica com o JWT do
    usuário).
  - Operações privilegiadas/transacionais (endpoint público de anamnese, ações
    admin cross-tenant, funil financeiro, comissão, baixa de estoque) → **service_role
    somente no servidor**, encapsuladas em **funções Postgres (RPC) transacionais**
    ou Server Actions com transação. Nunca expor `service_role` ao browser.
  - RLS é **defesa em profundidade**, não a única linha — mas é obrigatória.
- **Schema + RLS:** **Supabase CLI + migrations SQL** como fonte de verdade
  (migration-first). Tipos TS gerados por `supabase gen types`.
  **NÃO usar Prisma** — ele conecta como role privilegiada e ignora RLS por padrão,
  o que enfraqueceria justamente nossa barreira de segurança. Acesso via
  `supabase-js` tipado.
- **Auth:** Supabase Auth (email/senha) para staff **e** pacientes. Papel + clínica
  atual injetados como claims via **Custom Access Token Hook** (função Postgres).
- **E-mail transacional:** Resend (agendamento, senha, anamnese). SES é alternativa
  aceitável se a cliente preferir manter AWS.
- **Front:** React 18 + Tailwind + shadcn (herdados do Base44) + TanStack Query
  onde fizer sentido no cliente.
- **Testes:** Vitest + testes de policy (pgTAP ou suíte de integração contra um
  Supabase local). **CI com gate obrigatório** (lint + typecheck + testes).

## 3. Modelo de dados v1 (D0.2) — normalizado, multi-tenant, com RLS

**Regra de ouro:** toda tabela operacional carrega `clinica_id` (o tenant) **e tem
policy RLS** que (a) restringe ao(s) tenant(s) do usuário e (b) respeita o papel.
Entregue como migrations SQL do Supabase, migration-first.

**Plataforma (global, sem `clinica_id`):**
- `usuario`/auth (Supabase Auth), `paciente` (global; vínculo N:N com clínicas via
  `paciente_clinica`), `segmento` → `especialidade` (seed a partir das 66 do
  legado; **editável pelo admin** — decisão da call).

**Tenant (com `clinica_id` + RLS):**
- `clinica` (raiz do tenant; `tipo` = medica|estetica|odontologica|terapias →
  dirige white-label), `clinica_usuario` (staff + `papel` = binding de RBAC).
- `profissional` (→ usuario; N:N com `especialidade` e com `servico`; `intervalo`
  de disponibilidade).
- `servico` (**unificação de Servico + Procedimento** do Base44; `especialidade`,
  `duracao`, flag `exibir_publico`), `tabela_preco` + `item_tabela_preco`
  (SUS/convênio/particular), `convenio`.
- `agenda`/`consulta` (→ clinica, profissional, paciente; **N:N com servico**;
  `status`).
- Prontuário: `avaliacao_clinica`, `evolucao_sessao` (insumos_utilizados,
  prescricao, fotos), `documento_consentimento`, `formulario_anamnese`,
  `resposta_anamnese` (acesso público por `token`, sem login — via Edge Function).
- Comercial: `orcamento` + `item_orcamento` → `venda` → `pagamento`
  (kanban rascunho→enviado→aprovado/recusado, botão Vender).
- Financeiro: `lancamento_financeiro`, `conta_bancaria`, `movimentacao_conta`
  (gerada transacionalmente por RPC a cada baixa — corrige o bug de conciliação),
  `centro_custo`, `categoria_lancamento`, `comissao`.
- Estoque: `item_estoque`, `movimentacao_estoque` (lote/validade),
  `composicao_servico`.
- Marketing: `cupom`, `campanha`, `depoimento`, `sala_vip`, `lead`, `lead_sala_vip`.
- Assinatura: `assinatura_clinica` (→ `plano_assinatura`).

**Descartar do Base44:** campos `*_nome` desnormalizados (viram FK real);
`Procedimento` (fundido em `servico`); `MeusPupons.jsx` (cópia com typo);
`especialidade` como string livre (vira cadastro N:N).

**Storage (Supabase):** buckets por finalidade (fotos antes/depois, anexos de
anamnese, logos), com storage policies escopadas por `clinica_id`.

## 4. Correções obrigatórias vindas da auditoria do Base44

- **A1 — Base44 é single-tenant.** Só 6 de 32 entidades têm `clinica_id`. Todas as
  operacionais precisam de tenant + RLS no modelo novo.
- **A2 — Sem permissões no servidor.** `User` do Base44 é só `admin|user`. Nunca
  confiar em papel vindo do cliente. RBAC via claims + RLS + checagem em Server
  Action, testado.
- **A3 — Desnormalização.** Nomes copiados em toda entidade → FKs.
- **A4 — Duplicações.** Servico×Procedimento; `consulta.servicos[]` + `servico_id`
  ao mesmo tempo → N:N; MeusPupons.
- **A5 — Campanhas sem motor de disparo.** F1 entrega segmentação/CRUD; disparo
  real de WhatsApp é AD (cobrança à parte, Fase 2).
- **A6 — Aba "Cobranças" não é portada** (removida por decisão da cliente).
  Conciliação corrigida por design (movimentação transacional via RPC).
- **A7 — Portal/Landing do Base44 são single-clinic.** Marketplace multi-clínica
  (busca por cidade/especialidade, página da clínica, destaques, ranqueamento) usa
  o legado `www` como referência funcional e o Base44 como referência visual.
- **A8 — Substituir dependências do BaaS:** `anamnesePublica` (Deno + service role)
  → **reaproveitável quase intacta como Edge Function do Supabase** (mesmo runtime
  Deno); `SendEmail`→Resend; `UploadFile`→Supabase Storage.

## 5. Segurança (lições que afundaram o legado + armadilhas do Supabase)

- **RLS por `clinica_id` em TODA tabela operacional, desde a primeira migration.**
  Sem RLS, um acesso com a `anon`/`user` key vaza dados entre clínicas — é o mesmo
  erro do legado (isolamento só na aplicação), agora no banco. RLS não é "depois".
- **`service_role` NUNCA no browser.** Só em Server Actions/Route Handlers/Edge
  Functions server-side.
- **NUNCA** hardcodar segredos (chaves Supabase service_role, Resend, etc.).
  Tudo em env/Vercel/Supabase secrets. `.env` fora do git; só `.env.example`.
  (Legado tinha chaves AWS/SES no Dockerfile — não repetir.)
- **Testes obrigatórios** nas 3 áreas que mais quebram e não tinham cobertura:
  (1) policies RLS de isolamento entre clínicas, (2) RBAC por papel,
  (3) cálculos financeiros (orçamento/venda/desconto/comissão). Sem esses testes,
  a feature não é "done".
- Storage policies escopadas por clínica. Edge Function pública de anamnese valida
  o token e usa service role só para o registro correspondente.

## 6. Método de trabalho (como você deve operar)

1. **Migration-first + testes nas áreas críticas.** Feature sem policy RLS testada
   (e teste de RBAC/financeiro quando aplicável) não fecha.
2. **Vertical slices:** migration+RLS → RPC/Server Action → tela religada, ponta a
   ponta, antes da próxima feature.
3. **Checkpoints quinzenais** casados com as homologações da cliente. Ao fim de cada
   sprint, gere resumo do de-para atualizado (entrou / falta / sugere deslizar p/ F2).
4. **Não remova nada do escopo sem sinalizar** para repactuação por escrito.
5. **Antes de cada bloco novo,** confira a tela no Base44 (visual) e a regra no
   legado/Postman (comportamento).
6. Rode lint + typecheck + testes antes de considerar qualquer entrega pronta.
7. Commits pequenos e descritivos. Nunca commite segredos.

## 7. Papéis (RBAC — base do legado)

`admin` (plataforma), `proprietario`, `gerente`, `recepcionista`, `assistente`,
`profissional`, `cliente/paciente`, `guest` (público). Matriz papel×recurso×método
espelha o `AuthorizationListener` do legado, agora expressa em policies RLS +
checagens em Server Action. Claims (`papel`, `clinica_id`) via Custom Access Token
Hook. Isolamento garante que o usuário só acessa a(s) clínica(s) a que pertence.

## 8. Roadmap (4 sprints quinzenais · deadline F1 = 09/09/2026)

- **S0 (agora):** stack (fechada) + modelo de dados v1 (migrations+RLS) + repo + CI.
- **S1:** fundação (Supabase Auth + claims + RLS multi-tenant + RBAC, com testes de
  isolamento) + cadastros-núcleo + agenda/multiagenda (pixel parity Base44).
- **S2:** paciente global + prontuário completo + anamnese pública (Edge Function) +
  estoque-núcleo (itens+lote+baixa; a rastreabilidade de insumos do prontuário
  depende dele).
- **S3:** funil orçamento→venda→financeiro (RPC transacional) + conciliação +
  marketplace/landing multi-clínica + cupons + comissões.
- **S4:** white-label completo + marketing (Sala VIP, depoimentos, destaques,
  campanhas/segmentação) + relatórios aprimorados + convênios (CSV) + hardening e
  homologação final. Convênios/estoque-avançado são o buffer negociável.
- **F2:** estoque avançado, Open Finance, disparo WhatsApp real, monetização de
  destaque, evolução por voz, app mobile (do zero — Flutter legado é descartável).

Detalhe completo em `docs/auditoria-e-roadmap-sigo-clinicas.md`.

## 9. Em aberto — PERGUNTA À CLIENTE (reunião 15/07)

1. Modelo de cobrança do **destaque** na busca (AD).
2. Unificar **Anamnese + Avaliação** no prontuário? (M2).
3. Provider/comercial do **disparo WhatsApp** (AD).
4. KPIs prioritários dos **relatórios/dashboards**.
5. Validar conta **Apple Developer** (lead time longo — iniciar já).
6. Aprovar **Supabase/Vercel como SaaS** (custo recorrente + dados fora da AWS
   própria; LGPD ok em região São Paulo; self-host possível na F2 se quiserem).
7. Recomendar **rotação das credenciais** expostas no legado (independe do build).
