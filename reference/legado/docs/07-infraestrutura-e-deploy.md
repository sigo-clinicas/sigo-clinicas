# 07 — Infraestrutura e deploy

Toda a infra é **AWS** (região `us-east-1`, conta `304789899667`), provisionada
por **CloudFormation** (só na API) e publicada por **GitLab CI**. Não há
Terraform, Kubernetes nem Ansible.

## 1. Ambientes

**[FATO]** Três ambientes, um por branch, em todos os componentes web:

| Branch | Ambiente | API | Painel/site |
|---|---|---|---|
| `develop` | desenvolvimento | `dev-api.sigoclinicas.com.br` | `dev-app.sigoclinicas.com.br` |
| `homolog` | homologação | `homolog-api.sigoclinicas.com.br` | `homolog-app.sigoclinicas.com.br` |
| `master` | produção | `api.sigoclinicas.com.br` | `app.sigoclinicas.com.br` |

## 2. sigo-clinicas-api — ECS (container)

- **Docker** (`Dockerfile`): base `php:7.3-apache`; extensões intl, opcache,
  bcmath, exif, pdo_mysql, soap, memcached, gettext; Composer fixado 1.10.16;
  Xdebug só em `BUILD_ENV=DEVELOPMENT`; `php.ini` timezone `America/Sao_Paulo`,
  `display_errors=Off`, `sendmail_path=msmtp` (SES SMTP); expõe **80/443**.
- **CloudFormation** (`cloudformation.yaml`): deploy em **ECS** (cluster
  importado `zeus`), ALB com regra `host-header api.${Endpoint}` (HTTP+HTTPS),
  TargetGroup health check `/`, TaskDefinition (imagem ECR `api.sigoclinicas.com`,
  512 MB / 100 CPU, porta 80), **autoscaling por CPU/memória (2–4 tasks)**,
  buckets S3 `app.*` e `assets.*`, CloudFront + ACM, Route53, IAM user com
  grupos de bucket/SES.
- **Parâmetros de prod**: `Endpoint=sigoclinicas.com`,
  `DatabaseHost=addpix.caiwleyd7asi.us-east-1.rds.amazonaws.com`,
  `DatabaseUser/Name=sigoclinicas`, `DatabasePassword` como `NoEcho` (não
  versionado — correto).
- **CI** (`.gitlab-ci.yml`): Docker-in-Docker → `docker build/tag/push` para
  ECR `.../api.sigoclinicas.com.br` → `aws ecs update-service
  --force-new-deployment`. Serviços: `api-AppProduction` (master, tag latest),
  `api-AppHomolog` (homolog), `api-AppDevelopment` (develop).
- **Dev local**: `docker-compose.yml` — api :8080, **mysql:5.6** :3306, memcached.

## 3. sigo-clinicas-painel — S3 estático + CloudFront

- **[FATO]** CI (`node:8-alpine`, stage `deploy`): `npm install` →
  `echo "REACT_APP_API_URL=..." > .env` → `npm run build` →
  `aws s3 cp build/ s3://<bucket> --recursive` →
  `aws cloudfront create-invalidation`.

| Branch | Bucket S3 | CloudFront Distribution |
|---|---|---|
| develop | `dev-app.sigoclinicas.com.br` | `EJ5GA1XVZKQSN` |
| homolog | `homolog-app.sigoclinicas.com.br` | `E3A65PDCJB1Q87` |
| master | `app.sigoclinicas.com.br` | `E2D1BCA98D5YTU` |

- `Dockerfile`/`docker-compose.yml` existem **só para dev local** (node:10,
  `npm start`, :3000); **não** são usados no deploy (SPA estática).

## 4. sigo-clinicas-www — ECS (container)

- **[FATO]** Diferente do painel: o site **roda em container ECS**, não estático.
  CI faz build Docker (`node:10`) → push ECR
  `.../www.sigoclinicas.com.br` → serviços ECS `SiteDevService`/
  `SiteHomologService`/`SiteProductionService`.
- A base URL da API é injetada **em build time por `sed`** reescrevendo
  `services/api.js`.

## 5. sigo-clinicas-app — sem infra

- **[NÃO ENCONTRADO]** CI/CD (sem `.gitlab-ci.yml`, codemagic, fastlane).
  Identidade nativa ainda do template (`com.iotecksolutions.todoapp`), release
  assinado com debug key. Não publicável.

## 6. Variáveis de ambiente (consolidado)

Lista completa e onde cada uma é lida: `inventory/environment-variables.csv`.

### API (`sigo-clinicas-api`)
| Variável | Uso | Origem no código |
|---|---|---|
| `MYSQL_HOST_MASTER` | host do banco (master) | `config/autoload/doctrine.global.php` (`getenv`) |
| `MYSQL_HOST_SLAVE` | réplica opcional (ativa MasterSlaveConnection) | idem |
| `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DBNAME` | credenciais/DB | idem |
| `AWS_CREDENTIALS_KEY` / `AWS_CREDENTIALS_SECRET` | IAM p/ SDK | `config/autoload/aws.global.php` (`$_ENV`) |
| `AWS_S3_ASSETS_BUCKET` | bucket de uploads | vários resources (`$_ENV`) |
| `EMAIL_CONTATO1` | remetente de contato/senha | `ContatoResource.php`, `*SenhaResource.php` (`$_ENV`) |

Definidas no `docker-compose.yml` (dev) e na TaskDefinition do CloudFormation
(prod: `AWS_CREDENTIALS_*`, `AWS_S3_ASSETS_BUCKET`, `MYSQL_HOST_MASTER/USER/
PASSWORD/DBNAME`).

### Painel (`sigo-clinicas-painel`)
| Variável | Uso |
|---|---|
| `REACT_APP_API_URL` | base URL da API (`.env` versionado; sobrescrita no CI) |
| `NODE_ENV`, `PUBLIC_URL` | padrão CRA |

### Site (`sigo-clinicas-www`)
- **Não usa `process.env` no app** (só `NODE_ENV`). A base URL é hardcoded em
  `services/api.js` e trocada por `sed` no CI. `.gitignore` chega a ignorar
  `services/api.js` (que na prática está versionado e é reescrito).

## 7. Domínios, proxy, storage, observabilidade, rollback

- **Domínios**: `*.sigoclinicas.com.br` (Route53). `www` do bedin adiciona
  `hairbe.com`/`hairbe.com.br` **apenas no texto dos termos**, sem infra própria.
- **Proxy**: ALB (API) + CloudFront (todos). VirtualHost Apache com longa lista
  de `RemoteIPTrustedProxy` (subredes CloudFront/VPC) no `Dockerfile` da API.
- **Storage**: S3 — bucket de assets/uploads (`assets.${Endpoint}`) e buckets de
  hospedagem estática do painel (`app.*`).
- **Observabilidade**: **[NÃO ENCONTRADO]** APM, tracing, Sentry, CloudWatch
  dashboards versionados, logs estruturados. Health check do ALB em `/`. Ver `08`.
- **Rollback**: **[NÃO ENCONTRADO]** estratégia versionada. ECS permite reverter
  para uma TaskDefinition anterior e a tag `latest` dificulta rollback
  determinístico; S3+CloudFront exigiria re-deploy do build anterior. Risco
  documentado em `09`.

## 8. Divergências de infraestrutura

- **[FATO]** Domínio: `cloudformation.yaml` usa `sigoclinicas.com`; CI/e-mails
  usam `sigoclinicas.com.br`. Efetivo em prod é `.com.br` (**[INFERÊNCIA]**;
  CloudFormation parece defasado).
- **[FATO]** `bedin-www` publicaria na infra `sigoclinicas` (pipeline não
  ajustado) → risco de deploy do white-label sobre o produto principal (`09`).
