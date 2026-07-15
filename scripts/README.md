# scripts/ — seed de teste + limpeza da produção

Ferramentas de homologação manual. **Rodam contra o projeto remoto** (lêem
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` do `.env`) com
`service_role`, **server-side apenas**. Só INSEREM dado de teste — **não** tocam
no seed determinístico (66 especialidades, 4 segmentos) nem no schema.

> ⚠️ **Produção.** Autorizado pelo responsável para homologação; **remover antes
> do lançamento**. Todo dado é rastreável para o cleanup ser trivial.

## Rastreabilidade (âncoras de limpeza)
- **Clínica:** nome `[TESTE] Clínica Demo` (slug `teste-clinica-demo`).
- **Registros:** prefixo `[TESTE] ` no nome **e** vínculo por `clinica_id` (âncora
  principal — quase tudo cascateia do FK `clinica_id`).
- **Usuários:** somente o domínio reservado `@sigo.local`.

## `seed-teste.mjs` — cria o cenário
```bash
node scripts/seed-teste.mjs             # limpa teste anterior + cria de novo
node scripts/seed-teste.mjs --teardown  # só limpa (equivale ao .sql)
```
Cria: 1 clínica (estética), 6 logins (5 papéis de staff + 1 paciente — logins e
senhas definidos no topo do script), 2 profissionais, 3 serviços com preço
particular, 3 pacientes, 1 item de estoque (entrada 20 un, lote/validade) e 1
formulário de anamnese.

## `seed-teste-cleanup.sql` — remove TUDO no lançamento
Rodar no **SQL Editor do Supabase** (role `postgres`) ou via psql/service_role.
Idempotente. Apaga as clínicas `[TESTE]%` (e, por CASCADE, tudo gerado nelas
durante os testes: consultas, orçamentos, vendas, evoluções, respostas de
anamnese, comissões…), os leads dessas clínicas (o FK de `lead` é `SET NULL`, por
isso é tratado à parte), os pacientes `[TESTE]%`/órfãos e os usuários
`@sigo.local`. Ao final, a query de conferência deve retornar **0** em tudo.

Alternativa equivalente: `node scripts/seed-teste.mjs --teardown`.
