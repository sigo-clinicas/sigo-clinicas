# Funil público de agendamento — design (Fase pós-reskin)

> Data: 2026-07-17 · Status: aprovado pela liderança técnica
> Escopo: marketplace público (`/`, `/buscar`, `/clinica/[slug]`, `/clinica/[slug]/agendar`).
> **Não** toca o ERP pós-login, exceto as migrations D e F (autorizadas explicitamente).

## 1. Objetivo

Ligar o **motor afunilado** do marketplace (cidade → clínicas → especialidades →
clínica → serviço ↔ profissional → dia → horário → agendar), enriquecer a página da
clínica e montar a estrutura comercial da landing — preservando a experiência do
sistema antigo **sem reproduzir seus defeitos**, e sem mexer na pele já homologada.

## 2. Decisões de entrada (fechadas)

1. **"Reagendar com o mesmo profissional": fora.** Não existia no antigo; escopo novo.
2. **Agendamento por LEAD** (nome+telefone, sem login), como já está — o fluxo
   `/clinica/[slug]/agendar`. **Sem portal do paciente** nesta fase.
3. **Funil no servidor** (SSR + queries escopadas), em cascata, sem os bugs do antigo.
4. Duração com múltiplos serviços = **SOMA**. Desempate de preço = **menor valor**,
   depois nome da tabela.

## 3. O que a verificação adversarial refutou

O plano original partia de premissas que o código não sustenta. Registro para não
serem reintroduzidas:

| Premissa original | Veredito | Realidade |
|---|---|---|
| Espelhar `profissional_especialidade_select_marketplace` em `profissional_servico` | **Refutada** | `profissional_servico` carrega `tipo_comissao`/`valor_comissao` ([cadastros_nucleo.sql:137-138](../../../supabase/migrations/20260711090400_cadastros_nucleo.sql)). RLS é row-level. O padrão da casa é `to anon, authenticated`, e policies PERMISSIVE fazem OR entre roles → staff da clínica A leria comissão da B. |
| "Nunca `select *` nas queries públicas" fecha o vazamento | **Refutada** | Já está feito (zero `select *` em `marketplace.ts`) e o vazamento persiste: o vetor é o anon batendo direto no PostgREST com a chave publishable. Só `revoke select (col) from anon` resolve. |
| Corrigir teto de 25 / filtros que não compõem / N+1 | **Refutada** | Ficaram no legado; não foram portados. `buscar/page.tsx:81-89` já é pipeline único URL-state. O que sobrou é o `max_rows = 1000` do PostgREST com a arquitetura "traz tudo e filtra em memória". |
| Duas migrations aditivas bastam | **Parcial** | São 6. `formas_pagamento` auto-publica ao anon e **não** entra na view (colunas listadas uma a uma → precisa `drop`/recria/**regrant**). |
| RPC anti double-booking já resolve | **Parcial** | Existe e é transacional, mas detecta conflito por **igualdade exata** de instante e grava `duracao_minutos = 30` literal. Vira bug ativo quando o passo virar a duração do serviço. |

## 4. Migrations (6)

| # | Slice | Conteúdo | Painel |
|---|---|---|---|
| A | S0 | `revoke select (col) from anon` em `clinica`, `profissional`, `profissional_servico` | intocado |
| B | S1 | `profissional_servico_select_marketplace` **`to anon`** + gate estrito | intocado |
| C | S2 | `clinica.formas_pagamento` + recria `marketplace_clinica` + regrant | intocado |
| D | S5 | `clinica_horario (clinica_id, dia_semana, abertura, fechamento)` + RLS | **tela nova** |
| E | S6 | `clinica.timezone` default `America/Sao_Paulo` | intocado |
| F | S6 | `agendar_publico` v2 + `EXCLUDE` com `btree_gist` em `consulta` | **muda comportamento** |

## 5. Slices

### S0 — Fechar as colunas internas ao anon (HOTFIX)

Vulnerabilidade **viva em produção**: `has_column_privilege('anon', 'public.clinica',
'cnpj', 'SELECT')` = `true` no remoto. Sai sozinho, antes da fase.

Migration A: `revoke select (razao_social, cnpj, config, retencao_prontuario_meses,
retencao_fiscal_meses, retencao_marketing_meses, is_seed_demo) on public.clinica from anon`
e `revoke select (cpf, data_nascimento, user_id) on public.profissional from anon`.
Só `from anon` — `authenticated` intocado.

**DoD:** teste anon: `select("cnpj")` e `select("config")` **erram 42501**;
`select("nome,slug")` funciona. Semântica que importa: RLS bloqueada **filtra sem
erro**; privilégio de coluna ausente **erra**.

### S1 — Cruzamento serviço ↔ profissional

Migration B: policy **`to anon` apenas** (mínimo privilégio, quebra o padrão das
outras 16 de propósito), gate mais estrito que o original — clínica pública ∧
`profissional.ativo` ∧ `servico.exibir_publico` (o original só checa a clínica, o que
exporia vínculos de profissionais inativos e serviços não públicos). Mais
`revoke select (tipo_comissao, valor_comissao) ... from anon` — **só de anon**;
incluir `authenticated` quebraria `comissoes.ts:90` e `profissionais-client.tsx:276`.

**DoD:** isolamento; anon lê `servico_id` e **erra** em `valor_comissao`; regressão
cross-tenant com fixture **`exibir_marketplace: true`** (a atual usa `false` e nunca
dispara o gate); comportamento nos dois sentidos.

### S2 — Dados ricos da clínica

Migration C, numa migration só para não recriar a view duas vezes. Carrossel,
endereço legível, formas de pagamento, depoimentos, foto do profissional
(`foto_path` + bucket `logos`, já público).

**DoD:** anon lê `formas_pagamento` de clínica pública e não de não-pública;
`npm run db:types` regenerado (**não há gate de drift no CI** — esquecer passa silencioso).

### S3 — Rótulo de preço

Sem migration. Função pura reproduzindo o `viewPreco` do legado sem dois defeitos:
o ramo `'Gratuito'` era **dead code** (exigia preço truthy; gratuito tem valor 0/null →
caía em "Valor sob consulta"), e `tabelaSite[0]` sem `ORDER BY` era não-determinístico.
Enum novo: `fixo | a_partir_de | gratuito`; ausência de tabela pública = "Valor sob consulta".

Tabela de decisão (primeiro match vence), ramificando por `tipo_valor` **antes** do valor:

1. Sem item em tabela pública e ativa → `Valor sob consulta`
2. `tipo_valor = 'gratuito'` → `Gratuito`
3. `valor` nulo → `Valor sob consulta`
4. `tipo_valor = 'fixo'` → valor formatado, **sem rótulo** (paridade com o antigo)
5. `tipo_valor = 'a_partir_de'` → `A partir de R$ X`

**DoD:** teste unitário dos 5 ramos + "gratuito exibe Gratuito" (que o legado errava)
+ determinismo com 2 tabelas públicas.

### S4 — Cascata + push-down

Sem migration. Os parâmetros `filtros.cidade`/`filtros.especialidade` **já existem e
são código morto** ([marketplace.ts:58-78](../../../src/lib/marketplace.ts)) — nenhum
call site os usa. Ligar + match acento/caixa-insensível + paginação explícita contra o
`max_rows`. Filtros já compõem: aqui a entrega é **teste de caracterização**, não reescrita.

**DoD:** composição dos 4 filtros simultâneos; teste de volume > página.

### S5 — Horário de funcionamento: dado + painel

Migration D. `clinica.horarios` é jsonb `'{}'` sem shape, sem CHECK, sem UI que o
popule — ligar a regra hoje fecharia a agenda de toda clínica. Tabela, **não blob**: o
legado provou que blob apodrece (`clinica.horarios` usava `{abertura,fechamento}` e
`profissional.horarios` usava `{inicio,fim}` — incompatíveis, e o resultado é que o
horário da clínica era puramente decorativo).

Nada ainda depende dele: este slice só cria o dado para o S6 poder exigi-lo.

### S6 — Slots corretos ponta a ponta

Migrations E+F. Leitura (passo = duração somada, clínica ∩ profissional − intervalos −
ocupados, TZ-aware) **e** escrita (RPC v2 + `EXCLUDE`) no mesmo slice: separar criaria
inconsistência pior — slots refinados sobre uma escrita que ainda grava 30min e aceita
overlap. Módulo de cálculo **único** server-side (o legado tinha duas cópias divergentes
do gerador de slots).

**DoD:** teste de fuso explícito com `TZ=UTC`, teste de sobreposição parcial, teste de
corrida público×painel — **os três inexistem hoje**.

### S7 — Estrutura comercial da landing

Sem migration. Destaque **não existe no legado** (é greenfield); reaproveita
`destaque_ranking` do S3/S4. Ordenação parametrizável, **zero regra comercial chumbada**
— o modelo de cobrança segue pendente (§9.1 do CLAUDE.md).

## 6. DoD transversal

- **CI verde no job `policies-rls`**, não execução local: `npm test` sem
  `SUPABASE_TEST_*` pula os 32 arquivos de RLS **em silêncio**.
- Migrations também no remoto (`xbnveoshbqtekctzwnur`) via MCP, versão normalizada.
- RPC SECURITY DEFINER nova entra em `RPCS_SECDEF`
  ([hardening-fase1.test.ts:44](../../../tests/rls/hardening-fase1.test.ts)) com args corretos.
- Não mergear PR próprio se o auto-mode exigir revisão.
- Qualquer efeito colateral no painel → **parar e reportar**.

## 7. Fora de escopo (registrado, não removido em silêncio)

- Portal do paciente (login, "meus compromissos", agendar pré-selecionado).
- Reagendar com o mesmo profissional.
- Filtros de Data e Preço na busca: hoje são inertes sob "Em breve"
  ([buscar/page.tsx:41-42](../../../src/app/buscar/page.tsx)). Reintroduzir é **feature
  nova** (backend inexistente), não correção — repactuar por escrito (CLAUDE.md §6.4).
- **`LeadForm` órfão**: sem importador desde o reskin da home
  ([page.tsx:39-44](../../../src/app/page.tsx)). A tabela `lead` e sua rota existem.
  Reativar a captação na home é item separado, **não bloqueante** do funil.
- Modelo de cobrança do destaque (§9.1) — estrutura sim, regra comercial não.
