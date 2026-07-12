# Sigo Clínicas

SaaS de gestão para clínicas (médica, estética, odontológica, terapias) +
marketplace público de agendamento. Reconstrução Dizevolv — leia `CLAUDE.md`
(fonte de verdade) e `docs/auditoria-e-roadmap-sigo-clinicas.md` antes de
qualquer alteração.

**Stack (fechada):** Next.js (App Router) + TypeScript · Supabase (Postgres +
Auth + Storage + Edge Functions, sa-east-1) · Vercel · migrations SQL
(migration-first, **sem Prisma**) · RLS por `clinica_id` em toda tabela
operacional.

## Rodando local

```bash
npm install
cp .env.example .env.local        # preencher com os valores do supabase start

# Supabase local (requer Docker + Supabase CLI)
npm run db:start                  # sobe o stack e aplica supabase/migrations/
npm run db:types                  # gera src/lib/database.types.ts

npm run dev                       # http://localhost:3000
```

## Qualidade (gate de CI — obrigatório antes de qualquer entrega)

```bash
npm run lint
npm run typecheck
npm test                          # unitários
npm run test:rls                  # policies RLS/RBAC contra o Supabase local
```

Os testes de RLS (`tests/rls/`) exigem `SUPABASE_TEST_*` no ambiente (saída do
`supabase status`). Sem isso são pulados localmente — o CI sempre os executa.

## Regras que nunca se violam

- RLS por `clinica_id` em toda tabela operacional, desde a primeira migration.
- `SUPABASE_SERVICE_ROLE_KEY` só no servidor (`src/lib/supabase/admin.ts`,
  protegido por `server-only`). Nunca no browser, nunca em `NEXT_PUBLIC_*`.
- Nenhum segredo no código ou no git — só `.env.example` com chaves vazias.
- Schema muda **apenas** via `supabase/migrations/` (nunca no dashboard).
- Feature sem teste de RLS/RBAC (e financeiro, quando aplicável) não é "done".
