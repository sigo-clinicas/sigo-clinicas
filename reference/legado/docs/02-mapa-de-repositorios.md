# 02 — Mapa de repositórios

Sete repositórios independentes; todos remotos em `gitlab.com/sigo-clinicas/*`.
Commits do snapshot analisado (todos de 2022):

| Repositório | Branch | Commit | Última tag | Data do HEAD |
|---|---|---|---|---|
| sigo-clinicas-api | develop | `3c219a4` | v1.6.8 | 2022-07-04 |
| sigo-clinicas-painel | develop | `242692b` | v1.4.4 | 2022-09-01 |
| sigo-clinicas-www | develop | `f7cddec` | v1.3 | 2022-02-23 |
| sigo-clinicas-app | master | `fa8643b` | — | (raso) |
| bedin-api | develop | `3c219a4` | v1.6.8 | 2022-07-04 (idem api) |
| bedin-painel | develop | `242692b` | v1.4.4 | 2022-09-01 (idem painel) |
| bedin-www | develop | `2ddd102` | — | 2023-11-17 (fork www +1) |

---

## sigo-clinicas-api — Backend / API central

- **Responsabilidade**: toda a lógica de negócio, persistência, autenticação,
  autorização, uploads e e-mail. É o único componente que fala com o banco.
- **Entradas**: requisições HTTP REST (HAL/JSON) dos frontends; comando de
  console `agendamento`.
- **Saídas**: respostas REST; objetos gravados no S3; e-mails via SES.
- **APIs fornecidas**: ~30 recursos REST + 4 RPC (detalhe em `05-apis-e-contratos.md`).
  Endpoint de token OAuth2 em `POST /oauth`.
- **APIs consumidas**: AWS S3, Amazon SES (ambos via `aws-sdk-php`). Nenhuma
  outra API HTTP de terceiros.
- **Banco**: MySQL, schema `sigoclinicas` (Doctrine ORM, mapeamento YAML).
- **Filas/eventos**: nenhuma. Um único job de console (notificação por e-mail),
  projetado para cron.
- **Depende de**: RDS MySQL, S3, SES, ECR/ECS. Não depende de outro repositório.
- **Execução local**: `docker-compose up` (api :8080, mysql 5.6, memcached).
- **Deploy**: GitLab CI → build Docker → push ECR → `ecs update-service` (3
  ambientes: dev/homolog/prod). Ver `07-infraestrutura-e-deploy.md`.
- **Arquivos-chave**: `module/Clinica/config/module.config.php` (rotas, 462 KB),
  `module/Application/src/Listener/{Authentication,Authorization}Listener.php`,
  `config/autoload/oauth2.*.php`, `assets/mysql/dump.sql`, `Dockerfile`,
  `cloudformation.yaml`, `.gitlab-ci.yml`.

## sigo-clinicas-painel — ERP/CRM da clínica (SPA)

- **Responsabilidade**: interface administrativa completa para a clínica operar.
- **Entradas**: cliques da equipe (admin/gerente/recepção/profissional).
- **Saídas**: chamadas REST à API; PDF de orçamentos gerado no cliente
  (`@react-pdf/renderer`); eventos no Google Calendar.
- **APIs fornecidas**: nenhuma (é cliente).
- **APIs consumidas**: (1) API própria via `REACT_APP_API_URL`; (2) **Google
  Calendar API** (`react-google-calendar-api`, credenciais em
  `apiGoogleconfig.json`); (3) **ViaCEP** (via `react-via-cep`).
- **Banco**: nenhum (usa a API). Estado local em Redux + `localStorage`.
- **Autorização**: **CASL client-side** (`src/services/casl/index.js`,
  `src/config/ability.js`), regras por papel guardadas em `localStorage`.
- **Depende de**: `sigo-clinicas-api`.
- **Execução local**: `npm start` (`react-app-rewired`, porta 3000) ou
  `docker-compose up`.
- **Deploy**: GitLab CI → `npm run build` → `aws s3 cp build/` →
  `cloudfront create-invalidation`. Hospedagem **estática** em S3+CloudFront.
- **Arquivos-chave**: `src/index.js`, `src/routes/index.js`,
  `src/store/ducks/app.js` (auth), `src/services/{auth,casl,apii}/index.js`,
  `src/components/LayoutComponents/Menu/menuData.js`, `.gitlab-ci.yml`,
  `apiGoogleconfig.json`, `.env`.

## sigo-clinicas-www — Site público / marketplace (Next.js SSR)

- **Responsabilidade**: presença pública, busca e agendamento de pacientes,
  captação de clínicas, área do cliente.
- **Entradas**: visitantes anônimos e clientes logados; SEO/landing.
- **Saídas**: chamadas REST à API; formulário de contato comercial.
- **APIs consumidas**: API própria via `services/api.js`
  (`baseURL` default `https://dev-api.sigoclinicas.com.br`, reescrito no CI);
  ViaCEP (via `react-via-cep`) e busca de CEP dos Correios.
- **Autenticação**: OAuth2 password grant; token em **cookies** (`js-cookie`),
  header `Authorization` montado manualmente por chamada.
- **Depende de**: `sigo-clinicas-api`.
- **Execução**: servidor Next custom (`server.js`, porta 3000, `next-routes`).
- **Deploy**: GitLab CI → build Docker `node:10` → push ECR → **ECS** (3
  ambientes). (Diferente do painel: o site roda em container ECS, não estático.)
- **Arquivos-chave**: `server.js`, `routes.js`, `services/api.js`,
  `components/{Login,Busca,Detalhes,Cadastro,Perfil,Horarios}Component/`,
  `pages/landing/index.js`, `.gitlab-ci.yml`.

## sigo-clinicas-app — App mobile (Flutter) — ABANDONADO

- **Responsabilidade pretendida**: app mobile (cliente e/ou prestador).
- **Estado real [FATO]**: é o boilerplate `flutter-boilerplate-project` de
  zubairehman renomeado. **Nenhuma feature de clínica**; login é um
  `Future.delayed` falso; a única tela de dados consome **posts de
  `jsonplaceholder.typicode.com`** (`lib/data/network/constants/endpoints.dart:5`).
- **APIs consumidas**: apenas `jsonplaceholder` (demo). **Nenhuma referência a
  `sigoclinicas.com.br`** em `lib/`.
- **Integrações**: nenhuma (sem Firebase/FCM/SNS, sem deep links, sem CI).
- **Identidade nativa**: ainda `com.iotecksolutions.todoapp` (do template),
  release assinado com debug key.
- **Depende de**: nada operacional. Não integra ao resto do sistema.
- **Arquivos-chave**: `lib/routes.dart`, `lib/stores/form/form_store.dart`,
  `lib/data/network/`, `pubspec.yaml`, `README.md`, `CHANGELOG.md`.

## bedin-api / bedin-painel / bedin-www — White-label "HairBe"

- **bedin-api** e **bedin-painel**: **cópias byte-a-byte** de
  `sigo-clinicas-api` e `sigo-clinicas-painel` (mesmo commit, mesmo histórico).
  Não divergiram em nada. Ver `inventory/audit-report.md` (duplicação confirmada).
- **bedin-www**: fork de `sigo-clinicas-www` com **1 commit** ("ajustes
  iniciais") que troca a marca visível "SigoClínicas" → **"HairBe"** em títulos
  e termos de uso, e sobe Node 10→20. **API, CI/CD, Docker, ECR e a maioria dos
  links continuam `sigoclinicas.com.br`** — rebrand cosmético e incompleto.
- **Responsabilidade [INFERÊNCIA]**: instância white-label da plataforma para um
  cliente (marca "HairBe", vertical estética). "bedin" é só o nome do repo.
- **Deploy**: os mesmos `.gitlab-ci.yml` do sigo — publicariam na infra
  `sigoclinicas` (o pipeline do bedin-www **não** foi ajustado para uma conta/
  domínio próprios). Ver `09` (risco de deploy cruzado).

---

## Matriz de dependências entre repositórios

| Consumidor | Consome | Mecanismo | Confiança |
|---|---|---|---|
| sigo-clinicas-painel | sigo-clinicas-api | REST + OAuth2 (`REACT_APP_API_URL`) | **Confirmada** |
| sigo-clinicas-www | sigo-clinicas-api | REST + OAuth2 (`services/api.js`) | **Confirmada** |
| sigo-clinicas-app | *(nenhuma)* | aponta para jsonplaceholder | **Confirmada (ausência)** |
| sigo-clinicas-painel | Google Calendar API | `react-google-calendar-api` | **Confirmada** |
| painel / www | ViaCEP / Correios | `react-via-cep` | **Confirmada** |
| bedin-painel | bedin-api | REST + OAuth2 (código idêntico ao sigo) | **Inferida** |
| bedin-www | bedin-api / sigo-api | `services/api.js` ainda aponta `*.sigoclinicas.com.br` | **Confirmada (aponta p/ sigo)** |
| bedin-api | sigo-clinicas-api | cópia byte-a-byte (mesmo commit) | **Confirmada** |
| bedin-painel | sigo-clinicas-painel | cópia byte-a-byte (mesmo commit) | **Confirmada** |
