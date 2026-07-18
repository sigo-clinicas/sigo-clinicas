# Funil público de agendamento — de-para da fase (homologação)

> Fase pós-reskin. Reconstrói o **motor afunilado** do marketplace (cidade →
> clínicas → especialidades → clínica → serviço ↔ profissional → dia → horário →
> agendar) e a **estrutura comercial da landing**, preservando a experiência do
> sistema antigo **sem reproduzir seus defeitos** e sem mexer na pele homologada.
> Spec: `docs/superpowers/specs/2026-07-17-funil-publico-design.md`.
>
> Decisões de entrada (fechadas): sem portal do paciente; sem "reagendar com o
> mesmo profissional"; agendamento por lead (nome+telefone, sem login); funil no
> servidor. Duração de múltiplos serviços = SOMA. Desempate de preço = menor valor,
> depois nome da tabela.

## 1. Entrou na fase (pronto para homologar)

| # | Slice | O que foi entregue | PR | Migration |
|---|---|---|---|---|
| **S0** | Hotfix de segurança | Fecha o vazamento (vivo em produção) de `cnpj`/`razao_social`/`config`/`retenção_*`/`cpf`/`data_nascimento`/… ao anon, via **allowlist** de coluna | #49 | A |
| **S1** | Cruzamento serviço↔profissional | O coração do funil: escolher serviço lista os profissionais que o fazem, e vice-versa; comissão **nunca** legível ao anon | #50 | B |
| **S2** | Dados ricos da clínica | Carrossel de fotos, endereço completo, **formas de pagamento**, foto real do profissional, depoimentos | #51 | C |
| **S3** | Rótulo de preço | Reproduz o `viewPreco` do legado **sem 2 defeitos**: "Gratuito" era dead code; `tabelaSite[0]` sem `ORDER BY` era não-determinístico. + duração do serviço | #52 | — |
| **S4** | Cascata + escala | Cidade **acento/caixa-insensível** (grafias divergentes consolidam); composição de filtros extraída para função pura testável; teto explícito vs `max_rows` | #53 | — |
| **S5** | Horário de funcionamento | Tabela `clinica_horario` + RLS + **editor no painel** (7 dias) + exibição na página da clínica | #54 | D |
| **S6** | Slots corretos ponta a ponta | Slots **TZ-aware**, passo = duração somada, horário da clínica ∩ janela do prof; **RPC v2** (duração real, revalida janela); **constraint EXCLUDE** anti double-booking (fecha overlap parcial + corrida público×painel) | #55 | E, F |
| **S7** | Estrutura comercial da landing | Selo de destaque (parceiro/premium) na home e na busca; vigência editável no admin; **sem regra de cobrança chumbada** | #56 | — |

Cada slice em PR com CI verde (job `policies-rls`, contra um Postgres real). Testes
novos: RLS de não-vazamento/isolamento/RBAC + unitários das lógicas puras.

## 2. Migrations (6, todas verificadas em produção — remoto normalizado)

| # | Versão | Conteúdo | Toca o painel? |
|---|---|---|---|
| A | `20260717090000` | Allowlist de coluna: `revoke select` de tabela + `grant` só das colunas públicas, em `clinica`, `profissional`, `profissional_servico` (anon) | não |
| B | `20260717091000` | `profissional_servico_select_marketplace` **`to anon`** + gate estrito + allowlist | não |
| C | `20260717092000` | `clinica.formas_pagamento` + grant anon | não |
| D | `20260717093000` | `clinica_horario` (tabela) + RLS tenant + policy anon de marketplace | tela nova (autorizada) |
| E | `20260717094000` | `clinica.timezone` + grant anon | não |
| F | `20260717095000` | `btree_gist` + `consulta_periodo` (IMMUTABLE) + constraint EXCLUDE + `agendar_publico` v2 | muda comportamento (autorizado) |

## 3. O que a verificação adversarial evitou (antes de codar)

- **Espelhar a policy de `profissional_especialidade`** em `profissional_servico`
  vazaria `tipo_comissao`/`valor_comissao` (RLS é row-level; policies PERMISSIVE
  fazem OR entre roles) → policy é **`to anon` apenas** + allowlist.
- **"Nunca `select *`"** é no-op de segurança contra o PostgREST direto → a
  correção real é fechar o privilégio de coluna (allowlist).
- **Teto de 25 / filtros que não compõem** eram do legado, **não** foram portados →
  o esforço virou "endurecer escala" (teto explícito), não "corrigir bug".

## 4. Descobertas durante a implementação (não estavam no plano)

- **`revoke select (coluna)` é no-op** quando o role tem SELECT de tabela (default
  do Supabase) — o Postgres ignora. Padrão da fase: `revoke` de tabela + `grant` de
  colunas (allowlist). Bônus: **coluna nova nasce fechada** ao anon (resolveu por
  construção o risco de `formas_pagamento` auto-publicar).
- **`timestamptz + interval` é STABLE** → não entra em expressão de índice.
  Encapsulado numa função `consulta_periodo` **IMMUTABLE** (intervalo só em minutos,
  TZ-independente) para a constraint EXCLUDE.
- **Trigger de tenant** (`app.garantir_paciente_da_clinica`) dispara 23514 antes da
  EXCLUDE se o paciente não estiver vinculado — relevante para quem inserir consulta
  direto.
- **Cálculo de slots era 3h errado** em produção (getHours/getDay no TZ do processo,
  que na Vercel é UTC). Corrigido com fuso da clínica; teste com `TZ=UTC` trava.

## 5. Segurança (DoD cumprido)

- Vazamento de colunas internas ao anon **fechado em produção** (S0), provado por
  `has_column_privilege` e por `GET` direto retornando 42501.
- Comissão nunca legível ao anon (S1), inclusive cross-tenant para staff logado.
- Testes de **não-vazamento**, **isolamento** e **RBAC** por slice; **nenhum** teste
  do painel quebrou (227 testes verdes ao fim do S6).
- Verificações em produção só por leitura de privilégio/policy ou em transação com
  rollback (regra de processo).

## 6. Repactuado por escrito para a Fase 2 (não removido em silêncio)

- **Destaque de profissional/serviço**: hoje só existe destaque de **clínica**; a
  home e a busca só listam clínicas. Destaque de prof/serviço é feature nova, ligada
  ao **modelo de monetização** (decisão pendente §9.1) → F2.
- **Modelo de cobrança do destaque** (§9.1) — a estrutura está pronta (nível +
  score + vigência), sem regra comercial chumbada; a cobrança pluga depois.
- **Paginação keyset + push-down no Postgres**: hoje o funil traz tudo e filtra em
  memória, com teto explícito de 1000 (`max_rows`). Ordenar/paginar no banco exige
  materializar o `ranking` (hoje função por linha na view) → F2.
- **Split de horário da clínica** (almoço no nível da clínica): hoje 1 intervalo/dia;
  pausas finas ficam no profissional (`profissional_intervalo`).
- **Campo `formas_pagamento` no painel**: a coluna e a vitrine existem; o setter no
  painel da clínica não foi adicionado (limite S5/S6). Popula via seed p/ demo.
- **`clinica.horarios` (jsonb) órfão**: substituído pela tabela `clinica_horario`;
  a coluna morta pode ser removida numa limpeza (seed já migrado).
- **Portal do paciente / reagendar com o mesmo profissional**: fora desta fase por
  decisão registrada.

## 7. Pendências externas (config, não código)

- Rotação das credenciais expostas no legado (§9.7) — recomendação de operação.
- As decisões em aberto do §9 do CLAUDE.md seguem com a cliente.
