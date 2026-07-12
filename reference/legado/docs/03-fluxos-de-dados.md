# 03 — Fluxos de dados (ponta a ponta)

Referências no formato `repositório/caminho:linha`. **[FATO]** salvo indicação.

## 1. Autenticação → sessão → autorização

### No site público (`www`)
1. `POST {API}/oauth` com `{ grant_type: 'password', client_id: <email>,
   username, password, scope: '' }` — `sigo-clinicas-www/components/LoginComponent/index.js:23-32`.
   > Anti-padrão: o `client_id` recebe o **e-mail do usuário**; o `client_secret`
   > está comentado (`:26`).
2. `GET {API}/user-roles` para descobrir os papéis — `:35`.
3. Token e metadados gravados em **cookies** (`js-cookie`): `app.access_token`,
   `app.refresh_token`, `app.Role`, `app.userId`, `app.expires_at` (~30 min).
4. Cada chamada monta `Authorization: "Bearer " + Cookie.get('app.access_token')`
   manualmente. O refresh token é salvo mas **nunca usado** → re-login a cada 30 min.

### No painel (`painel`)
1. `POST {API}/oauth` (password grant, `client_id = username`) e depois
   `GET {API}/user-roles` — `sigo-clinicas-painel/src/store/ducks/app.js:94-146`.
2. Token gravado em `localStorage['auth']` (access, refresh, expires_at, user)
   — `src/services/auth/index.js:44-56`.
3. **Refresh** via `grant_type: 'refresh_token'` dentro do interceptor axios
   quando `expires_at` passou — `app.js:50-63`.
4. Login bloqueia papel `cliente` e usuário sem clínica (`app.js:115-121`),
   depois `push('/Painel/Agenda')` + `window.location.reload()`.
5. **Autorização client-side (CASL)**: `defineAbilitiesFor(role)` monta regras
   por papel×rota e as persiste em `localStorage['caslRules']`
   (`src/services/casl/index.js:137-497`); cada rota é embrulhada em
   `<Can I="read" a={path}>` (`src/routes/index.js:223-232`).

### No backend (`api`) — a fronteira de confiança real
1. O módulo `zf-mvc-auth` valida o Bearer token contra as tabelas `oauth2_*`.
2. **AuthenticationListener** (`EVENT_AUTHENTICATION_POST`): na rota de clínicas,
   verifica se o usuário tem acesso àquela clínica via
   `ClinicasRepository::getClinicaUser`; senão `ApiProblem 403`
   (`sigo-clinicas-api/module/Application/src/Listener/AuthenticationListener.php:36-100`).
3. **AuthorizationListener** (`EVENT_AUTHORIZATION`): monta a ACL papel×recurso×
   método e decide allow/deny
   (`.../Listener/AuthorizationListener.php:14-525`).

> **Ponto-chave**: a autorização do painel é cosmética (localStorage editável).
> A segurança efetiva está **inteiramente na API**. Ver `06`.

## 2. Agendamento público (paciente agenda) — fluxo mais importante do B2C

1. Busca: `GET {API}/clinicas?query[...]`, `GET {API}/especialidades`,
   `GET {API}/clinicas/{id}/profissionais`
   (`sigo-clinicas-www/store/sagas/{clinicas,profissionais}.js`,
   `components/Aside/index.js:27`).
2. Seleção de horário e, se sem token, abre modal de login (fluxo §1).
3. **Agendamento**: `POST {API}/clinicas/{idClinica}/agendas`
   (`sigo-clinicas-www/components/Horarios/index.js:136`).
4. No backend, `AgendasResource` persiste a `agenda` e **dispara e-mails via
   SES** (injetado por `AgendasResourceFactory.php:33`) para cliente e clínica.

## 3. Notificação de agendamento (e-mail transacional) — job de console

1. Comando de console `agendamento` mapeado em
   `sigo-clinicas-api/module/Application/config/module.config.php:60-73`.
2. `NotificationController::agendamentoAction` busca agendamentos das próximas
   24h (`AgendasRepository::getAgendamentosProximas24hs`,
   `.../Repository/AgendasRepository.php:169-188`).
3. Renderiza `view/mail/agendamento/{client,clinic}.phtml` e envia via
   `SlmMail\Mail\Transport\SesTransport` (remetente `contato@addpix.com.br`,
   `NotificationController.php:99,129`).
4. **[INFERÊNCIA]** Executado por **cron externo** (`php public/index.php
   agendamento`). **[NÃO ENCONTRADO]** nenhuma definição de cron/EventBridge
   versionada.

## 4. Upload de arquivo → S3

1. Recursos com anexo (fotos de clínica, ficha de anamnese) usam o filtro custom
   `Application\Filter\RenameUpload` (estende `S3RenameUpload` do AWS module),
   fábrica em `sigo-clinicas-api/module/Application/src/Filter/S3RenameUploadFactory.php:25-37`.
2. Bucket vem de `$_ENV['AWS_S3_ASSETS_BUCKET']`; cliente S3 do `aws-sdk-php`
   (`config/autoload/aws.global.php`).
3. Ex.: `ClinicasFotosController.php:119-240` (RPC `/clinicas/:clinica/fotos`),
   `FichasAnamneseResource.php:57-104`.

## 5. Orçamento → Venda → Financeiro (fluxo B2B)

1. Painel cria orçamento: `POST {API}/clinicas/:clinica/orcamentos` (+
   `/orcamentos-servicos`), imprime PDF no cliente.
2. Converte em venda: `POST {API}/clinicas/:clinica/vendas` (reusa o form de
   orçamento), registra `/venda-pagamentos`, categoriza `/vendas-categorias`.
3. Lança no financeiro: `/clinicas/:clinica/financeiros` (contas a pagar/
   receber, filtradas por `query[financeiros.tipoConta]` = pagar|receber e
   `query[financeiros.pendente]`).
4. Relatórios em `/Painel/Controles` (vendas, procedimentos, comissionamento) —
   agregações client-side sobre esses recursos.

## 6. Recuperação/criação de senha

1. `POST {API}/recuperar-senha` (público) gera token e envia e-mail (SES) —
   `RecuperarSenhaResource`.
2. `PATCH {API}/recuperar-senha/{token}` define a nova senha; análogo em
   `/criar-senha/{token}` para o primeiro acesso.
3. Frontends: `sigo-clinicas-www/components/{ForgotPassword,CreatePassword}Component`,
   `sigo-clinicas-painel/.../RegisterForm/index.js:627` (monta a URL de
   criar-senha usando `window.location.origin`).

## 7. Integração Google Calendar (somente painel)

1. Login Google no painel: `TopBar/ProfileMenu/index.js:65-75`
   (`react-google-calendar-api`, credenciais em `apiGoogleconfig.json`).
2. Ao salvar/editar/cancelar agenda, cria/atualiza/remove evento no Google
   Calendar do usuário (`Agenda/.../RegisterForm/index.js:814-828`,
   `ModalCancel/FormCancel.js:64`). É **espelhamento opcional**, paralelo à API.

## 8. Upload de config no deploy (como a base URL chega ao frontend)

- **www**: o `.gitlab-ci.yml` reescreve `services/api.js` por `sed` em build
  time, trocando o `baseURL` por dev/homolog/prod.
- **painel**: o CI faz `echo "REACT_APP_API_URL=..." > .env` antes do
  `npm run build`. Ambos frágeis (dependem da assinatura exata da linha).
