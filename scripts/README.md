# scripts/ — seed de teste, seed de demo e limpeza da produção

Ferramentas de homologação manual. **Rodam contra o projeto remoto** (lêem
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` do `.env`) com
`service_role`, **server-side apenas**. Só INSEREM dado de teste — **não** tocam
no seed determinístico (66 especialidades, 4 segmentos) nem no schema.

> ⚠️ **Produção.** Autorizado pelo responsável para homologação; **remover antes
> do lançamento**. Todo dado é rastreável para o cleanup ser trivial.

## Rastreabilidade (âncoras de limpeza)
O rastreio é pela **flag `is_seed_demo`** (migration `20260716120000_flag_seed_demo`),
não mais por marcador no nome — o antigo `[TESTE]` poluía a apresentação pública
(marketplace, página da clínica) e foi removido.
- **Clínica:** `clinica.is_seed_demo = true` (nome `Clínica Bem-Estar`, slug
  `clinica-bem-estar`). Âncora principal — quase tudo cascateia do FK `clinica_id`.
- **Pacientes:** `paciente.is_seed_demo = true` (globais) + os que ficam órfãos por
  só existirem na clínica de seed.
- **Usuários:** somente o domínio reservado `@sigo.local`.

## `seed-teste.mjs` — cria o cenário base
```bash
node scripts/seed-teste.mjs             # limpa teste anterior + cria de novo
node scripts/seed-teste.mjs --teardown  # só limpa (equivale ao .sql)
```
Cria: 1 clínica (estética), 6 logins (5 papéis de staff + 1 paciente — logins e
senhas definidos no topo do script), 2 profissionais, 3 serviços com preço
particular, 3 pacientes, 1 item de estoque (entrada 20 un, lote/validade) e 1
formulário de anamnese. Marca clínica e pacientes com `is_seed_demo = true`.

## `seed-demo.mjs` — ENRIQUECE a clínica para a demonstração
```bash
node scripts/seed-demo.mjs   # enriquece a clínica de seed (já criada pelo seed-teste)
```
Pressupõe que a clínica `clinica-bem-estar` já existe (rode o `seed-teste.mjs`
antes). Adiciona o cenário rico da demo: mais profissionais e serviços, convênios
e tabelas de preço, uma carteira maior de pacientes (com `is_seed_demo = true`),
cupons, campanhas, depoimentos e histórico. Tudo vinculado por `clinica_id` (some
no CASCADE do teardown) ou marcado pela flag.

## `seed-teste-cleanup.sql` — remove TUDO no lançamento
Rodar no **SQL Editor do Supabase** (role `postgres`) ou via psql/service_role.
Idempotente. Apaga as clínicas com `is_seed_demo = true` (e, por CASCADE, tudo
gerado nelas: consultas, orçamentos, vendas, evoluções, respostas de anamnese,
comissões, cupons, depoimentos…), os leads dessas clínicas (o FK de `lead` é
`SET NULL`, por isso é tratado à parte), os pacientes `is_seed_demo`/órfãos e os
usuários `@sigo.local`. Ao final, a query de conferência deve retornar **0** em
tudo.

Alternativa equivalente: `node scripts/seed-teste.mjs --teardown`.
