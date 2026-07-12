# Sigo Clínicas — Plano de Execução (Sprint 0 → Sprint 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a fundação do Sigo Clínicas (schema multi-tenant com RLS, RBAC via claims JWT, scaffolding Next.js+Supabase com CI) e o plano detalhado do Sprint 1 (fundação → cadastros-núcleo → agenda pixel-parity Base44).

**Architecture:** Next.js App Router com Server Actions/Route Handlers como backend; Supabase (Postgres sa-east-1 + Auth + Storage + Edge Functions) com acesso "Opção B" — client server-side ligado à sessão (RLS aplica com o JWT) para CRUD, e `service_role` só no servidor para RPCs transacionais. Schema migration-first via Supabase CLI.

**Tech Stack:** Next.js 14 (App Router) + React 18 + TypeScript · Tailwind + shadcn (herdados do Base44) · supabase-js + @supabase/ssr · Vitest · GitHub Actions.

## Global Constraints (do CLAUDE.md — nunca violar)

- RLS por `clinica_id` em **toda** tabela operacional, desde a primeira migration.
- `service_role` **nunca** no browser; só em Server Actions/Route Handlers/Edge Functions.
- Nenhum segredo hardcoded; `.env` fora do git; só `.env.example`.
- **Não usar Prisma** (conecta como role privilegiada e ignora RLS).
- Não recriar telas que o Base44 já tem — portá-las (pixel parity).
- Não remover feature de escopo sem sinalizar para repactuação por escrito.
- Migration-first sempre; RBAC, isolamento de tenant e cálculos financeiros sempre testados.
- React 18 mantido (CLAUDE.md §2) → Next.js 14.2 (App Router). Upgrade p/ Next 15/React 19 só como decisão explícita futura.

---

## PARTE 1 — Modelo de dados v1 (D0.2) — **ENTREGUE em `supabase/migrations/`**

11 migrations, ~40 tabelas, todas as operacionais com `clinica_id` + RLS habilitado e policies criadas **no mesmo arquivo que cria a tabela**:

| Migration | Conteúdo |
|---|---|
| `0100_fundacao` | Enums de domínio (valores do Base44/legado), schema `app` (helpers de claims: `app.clinicas()`, `app.is_admin()`, `app.tem_clinica()`, `app.papel()`, `app.tem_papel()`, `app.paciente_id()`), trigger `updated_at`, procedure `app.aplicar_padrao_tenant()` que gera as 4 policies padrão por tabela |
| `0200_plataforma` | `admin_plataforma`, `segmento` → `especialidade` (**seed: 4 segmentos + 66 especialidades exatas do dump legado, nomes higienizados**, editáveis pelo admin), `plano_assinatura` |
| `0300_identidade_rbac` | `clinica` (raiz do tenant, `tipo` white-label 4 valores), `clinica_usuario` (staff+papel, **anti-escalação**: gerente não concede papel proprietario), `paciente` **GLOBAL** + `paciente_clinica` (N:N com status), **Custom Access Token Hook** + grants/policies para `supabase_auth_admin` |
| `0400_cadastros_nucleo` | `convenio`, `servico` **unificado** (Servico×Procedimento fundidos; `exibir_publico`), `tabela_preco`+`item_tabela_preco` (SUS/convênio/particular), `profissional` + N:N (`_especialidade`, `_servico` c/ comissão, `_convenio`) + `profissional_intervalo` (disponibilidade fixo/pontual do legado); policies de marketplace anon |
| `0500_agenda` | `consulta` + `consulta_servico` (N:N — corrige `servicos[]`+`servico_id` duplicados); paciente vê as próprias |
| `0600_comercial` | `orcamento`+`item_orcamento` (kanban; `regioes` p/ odontograma/mapa estética) → `venda` (1:1 orçamento) → `pagamento` (parcelas normalizadas) |
| `0700_financeiro` | `categoria_lancamento`, `centro_custo`, `conta_bancaria`, `lancamento_financeiro`, `baixa_lancamento` + `movimentacao_conta` (**sem policy de INSERT — só RPC transacional**, correção A6 por design), view `saldo_conta_bancaria` (security_invoker), `comissao`; leitura restrita a proprietário/gerente |
| `0800_estoque` | `item_estoque`, `movimentacao_estoque` (lote/validade), view `saldo_item_estoque`, `composicao_servico` normalizada |
| `0900_prontuario` | `formulario_anamnese`, `resposta_anamnese` (token público **sem policy anon** — acesso só via Edge Function A8), `avaliacao_clinica`, `evolucao_sessao`, `evolucao_insumo` (snapshot imutável + FK real p/ estoque), `documento_consentimento` |
| `1000_marketing_assinatura` | `cupom`, `campanha` (segmentação F1; disparo=AD), `depoimento` (destaque/ranqueamento), `sala_vip`, `lead` (INSERT anon p/ captação sem login), `lead_sala_vip`, `assinatura_clinica` |
| `1100_storage` | Buckets `logos` (público), `prontuario`, `documentos` (privados) com policies por prefixo de path = `clinica_id` |

### Como cada achado A1–A8 foi resolvido

| Achado | Resolução no schema |
|---|---|
| **A1** single-tenant | `clinica_id NOT NULL` + RLS em toda tabela operacional; `paciente` global com vínculo `paciente_clinica` (N:N, com status — supera o pivô sem status do legado); dados de convênio do paciente movidos para o vínculo (são por clínica) |
| **A2** sem permissões no servidor | RBAC no banco: claims (`clinicas` = {clinica_id: papel}, `admin_plataforma`, `paciente_id`) via Custom Access Token Hook + policies por papel espelhando o `AuthorizationListener` do legado (ex.: financeiro só proprietário/gerente; profissional escreve prontuário/orçamento mas não deleta; recepção opera agenda/funil). Server Actions revalidam papel antes de operações sensíveis |
| **A3** desnormalização `*_nome` | Todos os `*_nome` viraram FK (`paciente_id`, `profissional_id`, `convenio_id`...). Exceções documentadas: `depoimento.paciente_nome` (depoimento externo sem cadastro) e snapshot de `evolucao_insumo` (registro clínico é imutável por natureza — mantém FK real além do snapshot) |
| **A4** duplicações | `servico` único (Procedimento fundido; preços via `item_tabela_preco`); `consulta_servico` N:N único; `MeusPupons.jsx` não será portado |
| **A5** campanhas sem motor | `campanha` guarda filtros/conteúdo/contadores (CRUD+segmentação F1); disparo real fica documentado como AD/F2 — nenhuma dependência de provider no schema |
| **A6** conciliação bugada | `movimentacao_conta` **não aceita INSERT de cliente** (sem policy); nasce apenas na RPC transacional `registrar_baixa_lancamento` junto com `baixa_lancamento` e atualização de status — impossível criar baixa sem extrato. Saldo é view derivada, não coluna. Aba Cobranças não é portada (M5) |
| **A7** portal single-clinic | `clinica.slug/cidade/exibir_marketplace` + policies `anon` de leitura (clinica, servico/tabela público, profissional, depoimento aprovado, sala VIP, cupom ativo) já preparam a busca multi-clínica; `lead` aceita INSERT anon (captação M3) |
| **A8** dependências BaaS | `resposta_anamnese.token` + Edge Function Supabase (mesmo runtime Deno — S2); `SendEmail`→Resend; `UploadFile`→ buckets com policies por clínica (migration 1100) |

**Outras decisões de modelagem** (fontes: legado + call 02/07): especialidade→segmento com seed real das 66 do dump (nomes limpos de `': '`/espaços); intervalos de disponibilidade do legado (`fixo` recorrente por dia da semana / `pontual`) + horário base simples do Base44 no `profissional` (pixel parity); comissão como tabela própria (`comissao`) em vez do flag `comissaoPaga` do legado; enums Postgres com os mesmos valores do Base44 para o porte das telas ser 1:1.

---

## PARTE 2 — Custom Access Token Hook + consumo nas policies — **ENTREGUE**

**Função:** `public.custom_access_token_hook(event jsonb)` (migration 0300). A cada emissão/refresh de token injeta:

```json
{
  "clinicas": { "<clinica_id>": "proprietario", "<outra>": "profissional" },
  "admin_plataforma": false,
  "paciente_id": "<uuid, se o usuário é paciente>"
}
```

- Fonte: `clinica_usuario` (ativo), `admin_plataforma`, `paciente.user_id`. Suporta usuário em N clínicas (requisito da plataforma; plano controla `multiplas_clinicas`).
- Permissões: executável apenas por `supabase_auth_admin` (grants + policies dedicadas de SELECT nas 3 tabelas). Nunca por `authenticated`/`anon`.
- Config: `supabase/config.toml` (local, já habilitado) e Auth→Hooks no dashboard (produção — passo do checklist de deploy).

**Consumo nas policies:** helpers `stable` em `app.*` leem `auth.jwt()` (custo ~zero, sem subquery por linha). Padrão gerado por `app.aplicar_padrao_tenant(tabela, papeis_escrita, papeis_delete, select_membro)`:

- `SELECT`: qualquer membro da clínica (`app.tem_clinica(clinica_id)`)
- `INSERT/UPDATE`: `app.tem_papel(clinica_id, papeis_escrita)`
- `DELETE`: `papeis_delete` (default = escrita; ex.: profissional escreve prontuário mas não deleta)
- Admin de plataforma passa em tudo; policies extras cobrem casos especiais (paciente vê o que é dele, marketplace anon, financeiro restrito, anti-escalação em `clinica_usuario`).

**Trade-off documentado:** claims são recalculados no *refresh* do token (~1h). Mudança/remoção de papel vale no próximo refresh; a Server Action que altera papel deve chamar `auth.admin.signOut(userId)` para revogação imediata (tarefa S1-2).

---

## PARTE 3 — Estrutura do projeto + scaffolding — **ENTREGUE**

```
├── CLAUDE.md / docs/ / reference/       # fonte de verdade + auditoria + referências
├── supabase/
│   ├── config.toml                      # local dev; hook habilitado
│   ├── migrations/                      # ÚNICA forma de mudar schema
│   └── seed.sql                         # massa local (domínio vai em migration)
├── src/
│   ├── app/                             # App Router (S1: (painel)/, (publico)/, api/)
│   ├── lib/supabase/
│   │   ├── server.ts                    # client da SESSÃO (RLS com JWT do usuário)
│   │   ├── admin.ts                     # service_role — "server-only", uso restrito
│   │   └── middleware.ts + middleware.ts# refresh de sessão
│   └── lib/database.types.ts            # gerado por `npm run db:types`
├── tests/
│   ├── rls/                             # testes de policy (isolamento/RBAC) — reais
│   └── unit/                            # unitários (cálculos financeiros no S3)
├── .github/workflows/ci.yml             # gate: lint+typecheck+testes+policies RLS
├── .env.example / .gitignore            # zero segredos no repo
└── package.json / tsconfig / tailwind / vitest
```

- **CI com gate** (2 jobs): `qualidade` (lint, typecheck, unit) e `policies-rls` (sobe Supabase local via CLI → aplica todas as migrations → roda `tests/rls`). Migration quebrada ou policy furada = build vermelho.
- **Teste modelo entregue:** `tests/rls/isolamento-clinicas.test.ts` valida o caminho real (login → hook → claims → policy): isolamento de serviços entre clínicas A/B, bloqueio de INSERT cross-tenant, invisibilidade de paciente não vinculado, anon sem acesso, e RBAC (recepcionista lê mas não cria cadastro).
- Branch protection + Vercel (projeto `gru1`, envs por ambiente) entram na tarefa S1-0 (exigem ações no GitHub/Vercel/Supabase Cloud — credenciais da Dizevolv).

---

## PARTE 4 — Plano do Sprint 1 (15–28/07, homologação 29/07) — aguarda OK

Vertical slices na ordem de dependência. **DoD global de toda tarefa:** lint + typecheck + testes verdes no CI; migration aplicada com `supabase db reset` limpo; sem segredo novo no código; tela conferida contra o Base44 (visual) e regra contra legado/Postman (comportamento).

### Task S1-0: Ambientes reais (Supabase Cloud + Vercel + repo)

**Files:** nenhum código novo — operações de console + `README.md` (seção deploy).
**Passos:** criar projeto Supabase em `sa-east-1` · habilitar o hook em Auth→Hooks · `supabase link` + `supabase db push` · criar projeto Vercel (região `gru1`) com envs (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` só server) · push do repo + branch protection (CI obrigatório).
**DoD:** deploy preview na Vercel renderiza a home; `select count(*) from especialidade` no Cloud = 66; CI verde no primeiro PR.

### Task S1-1: Autenticação (login/logout/recuperar senha) + guarda de rotas

**Files:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/recuperar-senha/page.tsx`, `src/app/(painel)/layout.tsx` (guarda: sem sessão → login; sem clínica → tela "sem vínculo" como o Base44 `UserNotRegisteredError`), Server Actions `src/lib/actions/auth.ts`.
**Interfaces (produz):** `getSessaoComClaims()` em `src/lib/auth.ts` → `{ user, clinicas: Record<string,Papel>, clinicaAtual, papel, isAdmin }` lendo o JWT — **toda** página/action do painel consome isso.
**Referência visual:** fluxo de auth do Base44 (`src/lib/AuthContext.jsx`) adaptado a Server Components.
**Testes (DoD):** teste RLS de sessão (usuário sem vínculo não lê nada); e2e manual do fluxo login→painel→logout documentado no PR.

### Task S1-2: Troca de clínica atual + gestão de usuários/papéis

**Files:** `src/app/(painel)/configuracoes/usuarios/page.tsx` (porta `GerenciamentoUsuarios.jsx`), `src/lib/actions/usuarios.ts` (convidar por e-mail via `auth.admin.inviteUserByEmail` — service_role; criar `clinica_usuario`; **revogar sessões ao mudar/remover papel**), seletor de clínica no header (claim `clinicas` com >1 entrada).
**Testes (DoD):** RLS: gerente não cria/promove proprietario (anti-escalação); papel removido perde acesso após signOut forçado. Vitest em `tests/rls/rbac-usuarios.test.ts`.

### Task S1-3: Cadastro da clínica + brancos do white-label básico

**Files:** `src/app/(painel)/configuracoes/page.tsx` (porta `Configuracoes.jsx`: dados, tipo de clínica, logo→bucket `logos`, horários), `src/lib/actions/clinica.ts`, contexto de terminologia `src/lib/clinica-context.tsx` (porta `ClinicaContext.jsx` — 4 tipos).
**Testes (DoD):** RLS: recepcionista não edita clínica; upload de logo só no path da própria clínica (teste de storage policy em `tests/rls/storage.test.ts`).

### Task S1-4: Especialidades dinâmicas (admin) + seleção pela clínica

**Files:** `src/app/(admin)/especialidades/page.tsx` (CRUD segmento/especialidade — só admin plataforma), multisseleção de especialidades no cadastro da clínica/profissional (decisão da call 02/07).
**Testes (DoD):** RLS: proprietário não edita `especialidade` global; anon lê ativas (marketplace).

### Task S1-5: Profissionais + intervalos de disponibilidade

**Files:** `src/app/(painel)/profissionais/page.tsx` (porta `Profissionais.jsx` + `ProfissionalModal.jsx`: dados, cor da agenda, horário base, dias, especialidades N:N, serviços+comissão N:N, convênios), gestão de `profissional_intervalo` (fixo/pontual — regra do legado), `src/lib/actions/profissionais.ts`.
**Testes (DoD):** RLS: profissional edita o próprio cadastro/intervalos mas não os de colegas; isolamento entre clínicas (`tests/rls/profissionais.test.ts`).

### Task S1-6: Serviços unificados + tabelas de preço + convênios

**Files:** `src/app/(painel)/servicos/page.tsx` (porta `Servicos.jsx` + `ServicoModal.jsx` + `TabelaPrecoModal.jsx` — SEM a dualidade Procedimento), `src/app/(painel)/convenios/page.tsx` (porta `Convenios.jsx`, sem o fechamento de guia CSV — fica no S4), `src/lib/actions/servicos.ts`.
**Testes (DoD):** RLS: isolamento + RBAC (recepcionista não cria serviço — teste já existe como modelo); `item_tabela_preco` gratuito sem valor passa, fixo sem valor falha (constraint).

### Task S1-7: Pacientes (cadastro global + vínculo) — mínimo p/ agenda

**Files:** `src/app/(painel)/pacientes/page.tsx` (porta `Pacientes.jsx` + `PacienteModal.jsx`), `src/lib/actions/pacientes.ts` — busca por CPF/e-mail global antes de criar (dedup), criação de `paciente` + `paciente_clinica` na mesma action.
**Testes (DoD):** RLS: clínica B não vê paciente só da A (teste já existe); staff vincula paciente existente sem duplicar cadastro global. *(Perfil completo/prontuário = S2.)*

### Task S1-8: Agenda/multiagenda pixel parity (meta da demo de 29/07)

**Files:** `src/app/(painel)/agenda/page.tsx` (porta `Agenda.jsx`: visões dia/semana/mês, filtro por profissional = multiagenda, cores) + `ConsultaModal.jsx` portado, `src/lib/actions/consultas.ts` (criar/mover/status; valida conflito com `profissional_intervalo` e horário base).
**Testes (DoD):** RLS isolamento de `consulta`; RBAC (profissional lê, não cria); unit de cálculo de disponibilidade (slots − intervalos); screenshot lado a lado com o Base44 na homologação.

### Task S1-9: Resumo do de-para do sprint (checkpoint quinzenal §6)

**Files:** `docs/checkpoints/2026-07-29-sprint1.md` — entrou / falta / sugere deslizar p/ F2, atualizando o §5 da auditoria.
**DoD:** revisado antes da homologação de 29/07.

**Fora do S1 (explícito, sem remoção de escopo):** prontuário/anamnese (S2), estoque-núcleo (S2), funil comercial+financeiro+marketplace (S3), white-label completo+marketing+relatórios+convênios-CSV (S4).

---

## PARTE 5 — Riscos e perguntas para a reunião de 15/07

**Perguntas à cliente (§9 do CLAUDE.md):**
1. **Destaque na busca (AD):** modelo de cobrança (mensalidade fixa? leilão de posição? por clique?). Precisamos só da decisão de *estrutura* até o S3 (marketplace).
2. **Unificar Anamnese + Avaliação no prontuário?** Impacta o S2 — se unificar, a UI muda mas o schema atual suporta os dois caminhos sem retrabalho.
3. **Disparo WhatsApp (AD):** provider (Meta Cloud API oficial × Z-API/Evolution) e modelo comercial. F1 entrega segmentação; sem decisão, nada se perde.
4. **KPIs prioritários dos relatórios** (D4.3) — sugerir lista curta: faturamento por período/profissional, taxa de comparecimento, ticket médio, conversão orçamento→venda, comissões.
5. **Conta Apple Developer:** iniciar validação JÁ (lead time; bloqueia F2 mobile).
6. **Aprovar Supabase/Vercel como SaaS:** custo recorrente estimado (Supabase Pro ~US$25/mês + Vercel Pro ~US$20/usuário/mês no início), dados em região São Paulo (LGPD ok), self-host possível na F2.
7. **Rotação das credenciais AWS/SES expostas no legado** (independe do build — proteger a cliente) + auditar se a infra legada segue gerando custo.

**Riscos técnicos e mitigação:**

| Risco | Prob. | Mitigação |
|---|---|---|
| 60 dias p/ escopo F1 | Alta | Etapas limitantes primeiro (S1 = fundação+agenda); convênios-CSV/estoque avançado como buffer negociável; trade-offs por escrito a cada homologação |
| Claims JWT defasados após troca de papel | Baixa | signOut forçado na action de mudança de papel (S1-2) + expiry 1h |
| Porte do Base44 (Vite/React Router → Next) mais lento que o previsto | Média | S1-8 começa cedo; componentes shadcn portam 1:1; data layer isolado em Server Actions desde o início |
| Regressão em RLS/RBAC/financeiro | Média | Gate de CI com testes de policy reais (já ativo no S0) + testes financeiros obrigatórios no S3 |
| Custo/latência do CI subindo Supabase por run | Baixa | Cache do CLI; se doer, mover policies-RLS p/ job noturno + obrigatório em PR de migration |

---

## Self-review (writing-plans)

- Cobertura do kickoff: item 1 ✔ (Parte 1 + migrations entregues), item 2 ✔ (Parte 2 + migration 0300), item 3 ✔ (Parte 3 + arquivos entregues), item 4 ✔ (Parte 4 com DoD por tarefa), item 5 ✔ (Parte 5).
- Sem placeholders TBD; tarefas S1 nomeiam arquivos exatos e componentes Base44 de origem.
- Tipos/nomes consistentes com as migrations (`clinica_usuario.papel`, claims `clinicas`/`admin_plataforma`/`paciente_id`, helpers `app.*`).
