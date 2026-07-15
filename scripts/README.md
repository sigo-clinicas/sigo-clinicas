# scripts/ — seed de teste, seed de demo e limpeza da produção

Ferramentas de homologação manual. **Rodam contra o projeto remoto** (lêem
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` do `.env`) com `service_role`, **server-side apenas**.
Só INSEREM/ATUALIZAM dado de teste — **não** tocam no seed determinístico
(66 especialidades, 4 segmentos) nem no schema/migrations.

> ⚠️ **Produção.** Autorizado pelo responsável para homologação; **remover antes
> do lançamento**. Todo dado é rastreável para o cleanup ser trivial.

> 🚫 **Nenhum destes scripts roda em build/deploy.** O build da Vercel é
> `next build` (veja `package.json`); não há `vercel.json`/`vercel.ts` nem passo
> de seed em `.github/`. São **manuais, sob demanda**. Não os adicione a
> `build`/`postinstall` nem a nenhum workflow.

## Rastreabilidade (âncoras de limpeza)
- **Clínica:** nome `[TESTE] Clínica Demo` (slug `teste-clinica-demo`).
- **Registros:** prefixo `[TESTE] ` no nome **e** vínculo por `clinica_id` (âncora
  principal — 43 das 44 tabelas cascateiam do FK `clinica_id`; só `lead` é
  `SET NULL`, tratado à parte).
- **Usuários:** somente o domínio reservado `@sigo.local`.
- **Storage:** arquivos sob o prefixo `<clinica_id>/…` nos buckets
  `prontuario` / `documentos` / `logos`.

## `seed-teste.mjs` — cria a BASE
```bash
node scripts/seed-teste.mjs             # limpa teste anterior + cria do zero
node scripts/seed-teste.mjs --teardown  # só limpa
```
Cria: 1 clínica (estética), 6 logins (5 papéis de staff + 1 paciente), 2
profissionais, 3 serviços com preço, 3 pacientes, 1 item de estoque e 1
formulário de anamnese.

> ⚠️ **Destrói os dados de demonstração.** É idempotente por
> *teardown-and-recreate*: apaga a clínica e recria com **novo `clinica_id`**;
> tudo do `seed-demo.mjs` vai junto no CASCADE. Se rodar, rode o `seed-demo.mjs`
> depois (ele reancora sozinho pelo slug).

## `seed-demo.mjs` — ENRIQUECE a clínica para a demonstração
```bash
node scripts/seed-demo.mjs                  # cria/atualiza o cenário de demo
node scripts/seed-demo.mjs --resumo         # só imprime o resumo por tela
node scripts/seed-demo.mjs --limpar-storage # remove as fotos do Storage
```
**Reusa** a `[TESTE] Clínica Demo` existente (lookup por slug — nunca cria outra
clínica) e preenche todas as telas com dados **encadeados**: 18 agendamentos,
12 pacientes, prontuário de 5 pacientes, kanban de orçamentos em todas as
colunas, 2 vendas → lançamentos → baixas → conciliação, comissões, 8 itens de
estoque (1 abaixo do mínimo, p/ o alerta), 3 convênios, marketing e marketplace.

**Idempotente de verdade:** cada linha tem `id` determinístico
(`uuidv5(namespace + clinica_id + chave lógica)`) ou chave natural → rodar 2x
faz `upsert` na mesma linha. *Verificado: 2ª execução = 0 diferenças em 47
tabelas.* As datas são relativas ao dia da execução (a agenda sempre "parece de
hoje") — reexecutar atualiza as datas **sem** duplicar registros.

**Por que ele faz login:** as RPCs transacionais (`vender_orcamento`,
`registrar_baixa_lancamento`, `apurar_comissao`, `baixar_insumos_evolucao`)
checam `app.tem_papel()`, que lê `auth.jwt()`. A `service_role` **não** tem claim
de clínica → responderia `sem_permissao`. Por isso o script autentica como
`demo@sigo.local` (proprietário) e usa esse JWT nas RPCs; dados simples entram
via `service_role`. Assim o financeiro é gerado pela **mesma lógica que a UI
usa** — os números batem entre telas.

## Limpeza no lançamento — **2 passos, nesta ordem**
```bash
# 1º) Storage (a API é o ÚNICO caminho — ver nota abaixo)
node scripts/seed-demo.mjs --limpar-storage

# 2º) Banco: rodar scripts/seed-teste-cleanup.sql no SQL Editor do Supabase
```
> **Por que o Storage não sai no `.sql`:** o Postgres do Supabase tem o gatilho
> `storage.protect_delete()`, que **recusa** `delete` direto em `storage.objects`
> (*"Use the Storage API instead"*, SQLSTATE 42501). Se o `.sql` tentasse, a
> exceção abortaria todo o bloco e **nada** seria apagado.

`seed-teste-cleanup.sql` é idempotente. Apaga as clínicas `[TESTE]%` (e, por
CASCADE, tudo gerado nelas), os leads dessas clínicas, os pacientes
`[TESTE]%`/órfãos e os usuários `@sigo.local`. Ao final, a query de conferência
deve retornar **0** em tudo, e a de sanidade deve mostrar **66** especialidades e
**4** segmentos.

Alternativa equivalente para o banco: `node scripts/seed-teste.mjs --teardown`
(mas o passo 1 do Storage continua necessário).
