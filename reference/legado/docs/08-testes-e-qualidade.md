# 08 — Testes e qualidade

Panorama honesto: **a cobertura de testes automatizados é quase inexistente** e
**nenhum pipeline roda testes** — o CI de todos os repositórios só faz deploy.

## 1. sigo-clinicas-api

- **PHPUnit** configurado (`phpunit.xml.dist`), mas a suíte aponta só para
  `module/Application/test`, com **2 testes de smoke**:
  `IndexControllerTest.php` e `ZZIndexControllerDevModeTest.php`.
- **Sem testes** para os módulos de domínio (Clinica, Cliente, User) — ou seja,
  toda a lógica de negócio, ACL e integrações **não têm cobertura**.
- **Lint**: PHP_CodeSniffer (`phpcs.xml`, padrão PSR2 + arrays curtos proibidos).
  Scripts Composer `cs-check`/`cs-fix`.
- **CI**: `.gitlab-ci.yml` **não roda phpunit nem phpcs** — apenas build/push/
  deploy Docker. Não há gate de qualidade.

## 2. sigo-clinicas-painel

- **[FATO]** **Nenhum arquivo de teste** (`*.test.js` → 0; sem `__tests__`, sem
  `setupTests`). `react-scripts test` disponível, sem suíte.
- **ESLint** minimalista que **desativa regras importantes**: `eqeqeq: off`,
  `array-callback-return: off`, `no-useless-escape: off`,
  `no-restricted-globals: off` (`.eslintrc:6-13`).
- **Prettier** via `husky` + `lint-staged` no pre-commit (formatação, não
  correção de bugs).
- **CI**: só deploy S3. Qualidade depende de formatação automática + revisão
  manual.

## 3. sigo-clinicas-www

- **[FATO]** Sem testes (nenhum `*.test.js`, sem Jest configurado no app).
- Muitos `console.log` de dados (inclusive IDs de usuário) e tratamento de erro
  por `console.log`.
- **CI**: só build Docker + deploy ECS.

## 4. sigo-clinicas-app

- **[FATO]** Existe `test/` do boilerplate (widget test genérico), sem teste de
  domínio (não há domínio implementado).
- Sem CI, sem lint gate.

## 5. bedin-*

- Idênticos aos sigo correspondentes (cópias) — mesmas ausências.

## 6. Riscos sem cobertura (o que mais preocupa)

| Área crítica | Cobertura | Risco |
|---|---|---|
| ACL / autorização por papel (API) | **nenhuma** | regressão de permissão passa despercebida |
| Isolamento multi-tenant (`AuthenticationListener`) | **nenhuma** | vazamento entre clínicas não seria detectado por teste |
| Fluxo OAuth2 / refresh | **nenhuma** | quebra de login só aparece em produção |
| Funil orçamento→venda→financeiro (cálculos monetários) | **nenhuma** | erro de valor/desconto silencioso |
| Agendamento + e-mail | **nenhuma** | falha de notificação não testada |
| Integração S3/SES | **nenhuma** | depende de ambiente real |

## 7. Recomendações mínimas (não implementadas)

1. Adicionar um **gate de CI** que rode `phpcs` + `phpunit` na API e `eslint`
   nos frontends antes do deploy.
2. Cobrir com testes as duas coisas mais sensíveis: **ACL/autorização** e
   **cálculos financeiros** (orçamento/venda/desconto).
3. Reativar as regras de ESLint desligadas (`eqeqeq` sobretudo), dado o uso
   massivo de `==`.
