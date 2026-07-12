# 05 — APIs e contratos

**Provedor único**: `sigo-clinicas-api`. Estilo **REST/HAL** (Apigility):
respostas `application/hal+json`, versionamento por `Accept`
(`application/vnd.<módulo>.v1+json`, módulo `zf-versioning`). Autenticação
**OAuth2 Bearer**. Padrão de URL **multi-tenant**: `/clinicas/:clinica/...`.

Base URLs por ambiente (do `.gitlab-ci.yml` da API e dos frontends):
- dev: `https://dev-api.sigoclinicas.com.br`
- homolog: `https://homolog-api.sigoclinicas.com.br`
- prod: `https://api.sigoclinicas.com.br`
- local (Postman): `http://localhost:8080`

> **[FATO/DIVERGÊNCIA]** O `cloudformation.yaml` parametriza `Endpoint =
> sigoclinicas.com` (sem `.br`), enquanto CI/e-mails usam `sigoclinicas.com.br`.
> Ver `07` e `09`.

## 1. Autenticação (OAuth2)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/oauth` | Token endpoint. `password` grant (frontends enviam `username`/`password`/`client_id`) e `refresh_token` grant. Liberado a todos (`AuthorizationListener.php:23`). |
| GET | `/user-roles` | Papéis do usuário autenticado (RPC `User\Roles`, `module/User/config/module.config.php`). |

Fluxo detalhado em `06-autenticacao-e-seguranca.md`.

## 2. Recursos REST — módulo Clinica (multi-tenant)

Definidos em `sigo-clinicas-api/module/Clinica/config/module.config.php`.
Cada recurso expõe o CRUD REST padrão (GET collection/entity, POST, PATCH,
PUT, DELETE), sujeito à ACL por papel.

| Rota | Recurso |
|---|---|
| `/clinicas[/:id]` | Clinicas |
| `/clinicas/:clinica/clinicas-servicos[/:id]` | ClinicasServicos |
| `[/clinicas/:clinica]/profissionais[/:id]` | Profissionais |
| `/clinicas/:clinica/clientes[/:id]` | Clientes (contexto clínica) |
| `[/clinicas/:clinica]/usuarios[/:id]` | Usuarios |
| `[/clinicas/:clinica]/servicos[/:id]` | Servicos |
| `/clinicas/:clinica/materiais[/:id]` | Materiais |
| `/clinicas/:clinica/tabelas-precos[/:id]` | TabelaPrecos |
| `/clinicas/:clinica/tabela-servicos[/:id]` | TabelaServicos |
| `/clinicas/:clinica/financeiros[/:id]` | Financeiros |
| `/clinicas/:clinica/financeiros/categorias[/:id]` | FinanceirosCategorias |
| `[/clinicas/:clinica]/servico-categorias[/:id]` | ServicoCategorias |
| `/clinicas/:clinica/servico-materiais[/:id]` | ServicoMateriais |
| `/clinicas/:clinica/grupo-materiais[/:id]` | GrupoMateriais |
| `/clinicas/:clinica/fichas-anamnese[/:id]` | FichasAnamnese (Clinica) |
| `[/clinicas/:clinica]/especialidades[/:id]` | Especialidades |
| `[/clinicas/:clinica]/segmentos[/:id]` | Segmentos |
| `[/profissionais/:profissional]/profissional-servicos[/:id]` | ProfissionalServicos |
| `[/profissionais/:profissional]/profissional-intervalos[/:id]` | ProfissionalIntervalos |
| `/clinicas/:clinica/agendas[/:id]` | Agendas |
| `/clinicas/:clinica/agenda-servicos[/:id]` | AgendaServicos |
| `/clinicas/:clinica/orcamentos[/:id]` | Orcamentos |
| `/clinicas/:clinica/orcamentos-servicos[/:id]` | OrcamentosServicos |
| `/clinicas/:clinica/vendas[/:id]` | Vendas |
| `/clinicas/:clinica/vendas-categorias[/:id]` | VendasCategorias |
| `/clinicas/:clinica/venda-pagamentos[/:id]` | VendaPagamentos |
| `/contato` | Contato (público, envia e-mail comercial) |

### RPC — módulo Clinica
| Rota | Controller |
|---|---|
| `/clinicas/:clinica/fotos[/:id]` | `ClinicasFotos` — upload/gestão de fotos (S3) |
| `[/clinicas/:clinica]/clientes/:cliente/historico` | `Historico` — histórico do cliente |

## 3. Recursos — módulo Cliente

| Método | Rota | Recurso |
|---|---|---|
| REST | `/clientes[/:id]` | `Cliente\Clientes` — auto-cadastro/perfil do paciente (`/clientes/me`) |
| REST | `[/clinicas/:clinica]/clientes/:cliente/fichas-anamnese[/:id]` | `Cliente\FichasAnamnese` |

## 4. Recursos — módulo User

| Método | Rota | Recurso |
|---|---|---|
| GET (RPC) | `/user-roles` | `Roles` |
| POST/PATCH | `/criar-senha[/:token]` | `CriarSenha` — primeiro acesso |
| POST/PATCH | `/recuperar-senha[/:token]` | `RecuperarSenha` |

## 5. Autenticação, payloads e erros

- **Autenticação**: Bearer token no header `Authorization`. Endpoints públicos
  (guest): `POST /clientes`, `POST /criar-senha`, `POST /recuperar-senha`,
  `POST /contato`, e vários **GET** do marketplace (clínicas, serviços,
  profissionais, tabelas, especialidades, agendas) — ver a matriz em `06`.
- **Filtros**: query string padrão `query[campo]=valor` e
  `query[campo][expr]=in|like|...` (ex.: `query[financeiros.tipoConta]=pagar`,
  `query[clinicas.ativo]=1`). Usado tanto pelo painel quanto pelo www.
- **Paginação**: `page_size`, `page` (ex.: `GET /clinicas?page_size=8`).
- **Erros**: formato **API Problem** (`application/problem+json`) do
  `zf-api-problem`; ex.: `403 "Acesso negado a esta Clínica"`
  (`AuthenticationListener.php`).
- **HAL**: coleções em `_embedded.data`, com `_links` de paginação
  (consumido em `sigo-clinicas-painel/src/store/sagas/schedule.js:25,48`).

## 6. Consumidores

| Consumidor | Como consome |
|---|---|
| `sigo-clinicas-painel` | ~20 recursos (clínicas-servicos, tabelas-precos, profissionais, agendas, orçamentos, vendas, financeiro, materiais...) via axios; `REACT_APP_API_URL`. |
| `sigo-clinicas-www` | oauth, user-roles, clientes(me), clinicas(+profissionais), agendas, especialidades, contato, criar/recuperar-senha. |
| `sigo-clinicas-app` | **nenhum recurso da API** — aponta para jsonplaceholder. |
| `bedin-painel` / `bedin-www` | mesmos recursos (código idêntico/fork). |

## 7. Contrato de referência: coleções Postman

`sigo-clinicas-api/assets/postman/` traz **18 coleções** (Clientes, ClinicaServicos,
Financeiros, FinanceirosCategorias, Orçamentos, OrçamentosServicos,
Profissionais, ProfissionalIntervalos, ProfissionalServicos, Servico,
ServicosCategorias, Tabela de Preços, UserRole, Usuarios, Vendas,
VendasCategorias, "Sigo Clínicas"). Ambiente `Local` usa `{{url}}=http://localhost:8080`
e `client_id/secret = addpix`. É o **contrato executável mais próximo de uma
spec** — não há OpenAPI/Swagger, GraphQL, gRPC ou protobuf no projeto.

A lista bruta de endpoints extraídos (Postman + chamadas HTTP dos frontends +
rotas Apigility) está em `inventory/endpoints.csv`.

## 8. Webhooks / outros contratos

- **[NÃO ENCONTRADO]** webhooks de entrada ou saída, GraphQL, gRPC, protobuf,
  filas/tópicos. A única "integração assíncrona" é o job de console de e-mail.
