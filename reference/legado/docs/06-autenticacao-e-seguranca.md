# 06 — Autenticação e segurança

## 1. Provedor de autenticação

**[FATO]** OAuth2 com persistência Doctrine, via
`api-skeletons/zf-oauth2-doctrine-permissions-acl` (+ `-console`,
`-mutatetablenames`). Configuração em
`sigo-clinicas-api/config/autoload/oauth2.doctrine-orm.global.php`:
- `object_manager` Doctrine, `bcrypt_cost = 10`, `auth_identity_fields =
  ['username']`.
- `dynamic_mapping` liga `Application\Entity\User` às entidades OAuth2 nativas
  (Client, AccessToken, AuthorizationCode, RefreshToken, Scope) com
  `ON DELETE CASCADE`.
- Tabelas renomeadas para o padrão `oauth2_*` via
  `oauth2.doctrine-orm.mutatetablenames.global.php`.
- Servidor OAuth2 nomeado por `NamedOAuth2ServerFactory`
  (`zf-mvc-auth-oauth2-override.global.php:7-13`).

## 2. Emissão e validação de tokens

- **Emissão**: `POST /oauth` (`ZF\OAuth2\Controller\Auth::token`), liberado a
  todos na ACL (`AuthorizationListener.php:23-24`).
- **Grant types [FATO]**: `oauth2_client.grantType` é `DC2Type:array`; os
  clientes semente (`addpix`, `addpix_mobile`) têm `grantType = NULL` (sem
  restrição) — `dump.sql:71-93`. **[INFERÊNCIA]** o fluxo real é **password
  grant + refresh token** (Postman e frontends enviam username/password/
  client_id/secret). Tabelas de authorization_code/JWT/public_key existem mas
  **sem evidência de uso ativo**.
- **Validação**: módulo `zf-mvc-auth` valida o Bearer contra `oauth2_accesstoken`.

## 3. Sessões (nos clientes)

| Cliente | Armazenamento do token | Refresh | Expiração |
|---|---|---|---|
| `www` | **cookies** `js-cookie` (`app.access_token`, `app.refresh_token`...) sem flags `secure`/`httpOnly`/`sameSite` | refresh salvo mas **nunca usado** | ~30 min → re-login |
| `painel` | **localStorage** (`auth`, `caslRules`) | `grant_type=refresh_token` no interceptor axios (`app.js:50-63`) | por `expires_at` |
| `app` | `SharedPreferences` (texto plano) previsto, mas **login é falso** | — | — |

## 4. Papéis e permissões

**[FATO]** 8 papéis hierárquicos (`role`, `dump.sql:48-56`; constantes em
`Application/src/Entity/Role.php:13-20`): guest, admin, proprietario, gerente,
recepcionista, assistente, profissional, cliente.

### Onde a autorização é decidida (dois lugares, um confiável)

1. **API (confiável) — `AuthorizationListener`**
   (`module/Application/src/Listener/AuthorizationListener.php:14-525`): monta
   uma ACL programática papel × recurso × método HTTP. Também há
   `zf-mvc-auth.authorization` declarativo em cada `module.config.php`.
   Resumo da matriz:
   - **admin/proprietario/gerente** → CRUD amplo na clínica.
   - **profissional** → leitura ampla + escrita em fichas-anamnese, clientes,
     agendas, orçamentos.
   - **assistente/recepcionista** → operação de agenda/vendas/orçamentos +
     leituras.
   - **cliente** → próprio cadastro, agendas (criar/ver), leitura de
     serviços/tabelas/profissionais.
   - **guest (público)** → `POST` em `Cliente\Clientes`, `User\CriarSenha`,
     `User\RecuperarSenha`, `Clinica\Contato`; `GET` público de
     clínicas/serviços/profissionais/tabelas/especialidades/agendas
     (`AuthorizationListener.php:472-524`).

2. **API — `AuthenticationListener`** (isolamento de tenant): na rota de
   clínicas, garante que o usuário pertence à clínica do `:clinica` da URL
   (`ClinicasRepository::getClinicaUser`), senão `403`
   (`AuthenticationListener.php:36-100`). Admin passa livre.

3. **Painel (NÃO confiável) — CASL client-side**: `defineAbilitiesFor(role)`
   monta regras por rota e as guarda em `localStorage['caslRules']`; `<Can>`
   esconde rotas/botões (`src/services/casl/index.js`, `src/config/ability.js`,
   `src/routes/index.js`). É **UX**, não segurança — o usuário pode editar o
   localStorage. A defesa real é a ACL da API.

## 5. Guards e middlewares

- **API**: listeners registrados em `onBootstrap` (prioridade 100, só fora do
  console) — `module/Application/src/Module.php:73-86`.
- **Painel**: `PrivateRoute` + `<Can>` (client-side); interceptor axios injeta
  `Authorization` exceto em `oauth`/`user-roles` (`app.js:43-76`).
- **www**: header `Authorization` montado manualmente por chamada; `services/
  auth.js` só checa presença do cookie.

## 6. RLS / políticas de banco

- **[NÃO ENCONTRADO]** Row-Level Security, views de segurança, roles de banco por
  tenant. O isolamento multi-tenant é **aplicacional** (o
  `AuthenticationListener` filtra por clínica). Se um endpoint esquecer o
  escopo `/clinicas/:clinica`, não há rede de proteção no banco.

## 7. Pontos de confiança entre serviços

- Frontends → API: confiança via Bearer token OAuth2 (correto).
- API → AWS (S3/SES): credenciais IAM em variáveis de ambiente (`AWS_CREDENTIALS_*`).
  Em dev, **hardcoded** no `docker-compose.yml`/`Dockerfile` (ver §8).
- Painel → Google Calendar: OAuth Google no browser, chave em
  `apiGoogleconfig.json` embarcada no bundle (pública por natureza).
- Não há confiança serviço-a-serviço interna (não há microsserviços).

## 8. Possíveis falhas de segurança (resumo; detalhe e prioridade em `09`)

| Severidade | Falha | Evidência |
|---|---|---|
| 🔴 Crítica | Chaves AWS e senha SMTP SES **hardcoded e versionadas** | `sigo-clinicas-api/Dockerfile:95-96`, `docker-compose.yml:20-22` (idem `bedin-api`) |
| 🔴 Crítica | Credenciais semente triviais `addpix`/`addpix` no dump | `dump.sql:61-93` |
| 🟠 Alta | **CORS `*`** em produção permitindo header `Authorization` | `config/autoload/cors.global.php:7-51` |
| 🟠 Alta | Google API Key no repositório/bundle | `*-painel/apiGoogleconfig.json` |
| 🟠 Alta | Token/permissões em `localStorage`/cookies sem flags → XSS | painel e www |
| 🟠 Alta | `client_id = e-mail do usuário`; password grant no frontend | `www/.../LoginComponent`, `painel/.../ducks/app.js` |
| 🟡 Média | `display_exceptions => true` vaza stack traces | `module.config.php` de vários módulos |
| 🟡 Média | `.env` versionado apesar do `.gitignore` | `*-painel/.env` |
| ⚪ Baixa | Código morto de autorização (`instanceof UsuariosEntity` inalcançável) | `AuthenticationListener.php:63` |

> Nota: os segredos aparecem **redigidos** nos XMLs deste pacote
> (`[REDACTED_SECRET]`), mas **existem em claro** nos repositórios originais.
> Ver `security/potential_secrets_report.md`.
