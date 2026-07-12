# 09 — Riscos, dívidas e inconsistências

Cada item traz: **criticidade**, **evidência**, **repositório(s)**,
**arquivos**, **impacto** e **sugestão de investigação**. Nenhuma correção foi
aplicada — este é um relatório.

Legenda de criticidade: 🔴 crítica · 🟠 alta · 🟡 média · ⚪ baixa.

---

## 🔴 R1 — Segredos AWS/SES hardcoded e versionados
- **Evidência**: chave AWS e senha SMTP do SES em `Dockerfile:95-96` e
  `docker-compose.yml:20-22`.
- **Repos**: `sigo-clinicas-api` **e** `bedin-api` (cópia).
- **Impacto**: qualquer pessoa com acesso ao repositório (ou ao histórico Git)
  obtém credenciais de nuvem — risco de uso indevido de S3/SES, custo e
  vazamento de dados. Estão em **4 lugares** contando as cópias bedin.
- **Investigar/agir**: rotacionar as chaves IAM e a senha SES **imediatamente**,
  remover do histórico (git filter-repo/BFG), mover para variáveis de CI/Secrets
  Manager.

## 🔴 R2 — Credenciais semente triviais no dump
- **Evidência**: usuário `addpix`/senha `addpix` e client secret `addpix` (hashes
  bcrypt) em `dump.sql:61-93`; comentários revelam os valores em claro.
- **Repos**: `sigo-clinicas-api`, `bedin-api`.
- **Impacto**: se o dump for aplicado em produção/homolog, há um usuário e um
  client OAuth2 com credenciais públicas conhecidas.
- **Investigar**: confirmar que produção **não** usa essas credenciais; remover
  do dump ou trocar por placeholders.

## 🔴 R3 — Stack inteira em End-of-Life
- **Evidência**: PHP 7.3 (`composer.json:18`), Zend Framework/Apigility
  (descontinuados 2020), MySQL 5.6 (`docker-compose.yml:27`), Next 7 + React 16 +
  CRA 1 (Webpack 3, `sigo-clinicas-painel/package.json`), Flutter beta pré-null-
  safety.
- **Repos**: todos.
- **Impacto**: sem patches de segurança; vulnerabilidades conhecidas acumuladas;
  contratação e manutenção difíceis; caminho de upgrade caro (ZF→Laminas,
  CRA→Vite, Flutter null-safety).
- **Investigar**: `composer audit`/`npm audit` (offline aqui), planejar migração
  por camada, começando pela API (Laminas) e pelo MySQL.

## 🟠 R4 — CORS `*` em produção com Authorization permitido
- **Evidência**: `config/autoload/cors.global.php:7-51` (`allowed_origins=['*']`,
  headers incluem `Authorization` e `token`).
- **Repos**: `sigo-clinicas-api`, `bedin-api`.
- **Impacto**: qualquer origem pode chamar a API do browser com o token da
  vítima (mitigado só porque o token não vai como cookie automático, mas ainda
  amplia superfície de CSRF/abuso).
- **Investigar**: restringir a lista de origens aos domínios `app`/`www`
  conhecidos por ambiente.

## 🟠 R5 — Google API Key exposta no bundle
- **Evidência**: `apiGoogleconfig.json` (raiz, versionado) com API Key + clientId
  OAuth.
- **Repos**: `sigo-clinicas-painel`, `bedin-painel`.
- **Impacto**: chave pública no bundle; sem restrição de referrer pode ser
  abusada (custo/cota).
- **Investigar**: confirmar restrição por HTTP referrer/API no Google Cloud
  Console; rotacionar.

## 🟠 R6 — Autorização de frontend puramente client-side
- **Evidência**: CASL em `localStorage` (`sigo-clinicas-painel/src/services/casl/
  index.js`, `src/config/ability.js`).
- **Repos**: `sigo-clinicas-painel` (e cópia).
- **Impacto**: usuário pode editar `caslRules`/`auth` no localStorage e liberar
  telas. **Só é seguro se a API negar de fato** — o que depende inteiramente da
  ACL do backend (que não tem testes; ver R12).
- **Investigar**: auditar se **toda** ação sensível do painel é barrada pela ACL
  da API mesmo com o front adulterado.

## 🟠 R7 — Tokens/permissões sem flags de segurança
- **Evidência**: `www` guarda token em cookies `js-cookie` sem
  `secure/httpOnly/sameSite`; `painel` guarda em `localStorage`.
- **Repos**: `sigo-clinicas-www`, `sigo-clinicas-painel` (+ cópias).
- **Impacto**: um XSS rouba o token facilmente.
- **Investigar**: migrar para cookies `httpOnly`+`secure` emitidos pelo backend,
  ou pelo menos `sameSite`.

## 🟠 R8 — App mobile é boilerplate abandonado (não é o produto)
- **Evidência**: aponta para `jsonplaceholder` (`endpoints.dart:5`), login falso
  (`form_store.dart:119-133`), `applicationId=com.iotecksolutions.todoapp`,
  release com debug key.
- **Repos**: `sigo-clinicas-app`.
- **Impacto**: expectativa de "app oficial" é falsa; qualquer roadmap mobile
  parte praticamente do zero.
- **Investigar**: decidir descontinuar formalmente ou reescrever; não há nada
  reaproveitável além do scaffolding.

## 🟠 R9 — Deploy cruzado do white-label bedin
- **Evidência**: `bedin-www/.gitlab-ci.yml` e `services/api.js` **idênticos** aos
  do sigo — apontam para ECR/ECS e API `sigoclinicas.com.br`.
- **Repos**: `bedin-www` (e as cópias bedin-api/painel).
- **Impacto**: um `git push` no bedin publicaria na infraestrutura de produção
  do **sigo**, podendo sobrescrever o produto principal, e o rebrand HairBe
  continuaria consumindo a API sigo.
- **Investigar**: se o white-label for real, criar conta/ECR/buckets/domínio
  próprios e ajustar o pipeline antes de qualquer deploy.

## 🟡 R10 — Divergência schema ↔ ORM (`clinica_cliente_status`)
- **Evidência**: `ClientesStatusEntity.dcm.yml` mapeia `clinica_cliente_status`,
  ausente do `dump.sql` (só há `clinica_has_cliente`, sem `ativo`).
- **Repos**: `sigo-clinicas-api`.
- **Impacto**: consultas a status de cliente podem falhar se a tabela não
  existir no ambiente; sinal de que o dump está defasado do schema real.
- **Investigar**: comparar o schema de produção com o dump; adotar Doctrine
  Migrations.

## 🟡 R11 — Divergência de domínio na infra
- **Evidência**: `cloudformation.yaml` usa `sigoclinicas.com`; CI/e-mails usam
  `sigoclinicas.com.br`.
- **Repos**: `sigo-clinicas-api`.
- **Impacto**: confusão de roteamento/certificado; o template IaC não reflete o
  domínio efetivo.
- **Investigar**: alinhar `Endpoint` do CloudFormation ao domínio real de prod.

## 🟡 R12 — Zero cobertura de testes + CI sem gate
- **Evidência**: só 2 smoke tests na API; nenhum nos frontends; CI só faz deploy.
- **Repos**: todos.
- **Impacto**: regressões de ACL, multi-tenant e cálculo financeiro passam
  direto. Ver `08`.
- **Investigar**: introduzir gate de CI e testes nas áreas sensíveis.

## 🟡 R13 — `display_exceptions => true` em produção
- **Evidência**: `module/Application/config/module.config.php:114-115` e outros
  módulos; `config/application.config.php:5-6`.
- **Repos**: `sigo-clinicas-api`.
- **Impacto**: stack traces vazam detalhes internos em erros.
- **Investigar**: garantir `false` no ambiente de produção.

## 🟡 R14 — `.env` versionado
- **Evidência**: `.env` está no `.gitignore` mas versionado (commitado antes) em
  `sigo-clinicas-painel/.env`.
- **Repos**: `sigo-clinicas-painel`, `bedin-painel`.
- **Impacto**: vaza o endpoint de ambiente; risco maior se algum dia contiver
  segredo.
- **Investigar**: `git rm --cached .env` e manter só `.env.example`.

## ⚪ R15 — Código morto / template não removido
- **Evidência**: no painel, diretórios inteiros do template "Clean UI React"
  (`src/pages/Layout/*`, `Icons/*`, `AntComponents/*`, `DefaultPages/{Invoice,
  Lockscreen,Pricing,...}`), arquivo `index copy.js`, dois `menuData`. Na API,
  ramo `instanceof UsuariosEntity` inalcançável (`AuthenticationListener.php:63`)
  e linhas duplicadas na ACL (`AuthorizationListener.php:267-270`).
- **Impacto**: ruído, bundle inflado, superfície de confusão.
- **Investigar**: limpeza incremental.

## ⚪ R16 — Dependências server-side inúteis no frontend
- **Evidência**: `nodemailer`, `node-correios`, `npm` como deps do painel sem
  uso em `src/`.
- **Impacto**: peso e risco de supply chain.
- **Investigar**: remover deps não usadas.

## ⚪ R17 — Refresh de sessão frágil (www não usa refresh; painel congela closure)
- **Evidência**: `www` salva refresh token mas nunca o usa (re-login a cada
  30 min); `painel` captura `access_token`/`expires_at` em closure no registro
  do interceptor (`app.js:41-49`) — tokens novos só valem após reload; logout
  via `localStorage.setItem('auth', false)` (string, não remoção).
- **Impacto**: UX ruim e possível sessão residual.
- **Investigar**: refatorar o gerenciamento de sessão.

---

## Consumidos-mas-ausentes / definidos-mas-não-consumidos

- **Contrato definido, não consumido**: recursos da API cobertos por Postman mas
  sem consumidor identificado nos frontends (ex.: `venda-pagamentos` só no
  painel; `segmentos`/`agenda-servicos` com uso parcial) — não é bug, mas
  superfície não exercitada.
- **Consumido-mas-não-encontrado**: o `www` chama `POST /contato` e o painel usa
  `POST /criar-senha` diretos; ambos existem na API (OK). Não encontrei
  endpoints chamados pelos frontends que **não** existam na API.
- **Tabela referenciada sem migration**: `clinica_cliente_status` (R10).
- **Push/pagamento esperados mas ausentes**: o produto sugere notificações e
  pagamentos, mas só há e-mail (SES) e registro de pagamento como dado — sem
  gateway nem push real.
