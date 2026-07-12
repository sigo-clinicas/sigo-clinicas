# 00 — Leia primeiro

Este pacote de contexto foi gerado automaticamente pelo script determinístico
`tools/build_context.py` a partir da pasta raiz do **Seguro Clínicas**
(`repositorio-antigo`). Ele consolida o conteúdo integral dos repositórios em
XMLs auditáveis, protege segredos e documenta a arquitetura.

> **Aviso de marca.** Os repositórios estão sob a organização GitLab
> `sigo-clinicas`. O produto aparece no código como **"Sigo Clínicas"** /
> "SigoClínicas". O nome "Seguro Clínicas" foi usado pela pessoa que solicitou
> esta análise; **não há evidência da string "Seguro Clínicas" no código** — o
> nome versionado é "Sigo Clínicas". Trato os dois como o mesmo produto.

## O que foi encontrado

- **7 repositórios Git independentes** na raiz (nenhum aninhado; nenhum
  submódulo de código-fonte além de uma referência quebrada em app).
- **4054 arquivos descobertos** no total (incluindo `.git`), dos quais **3581**
  entraram com conteúdo integral, **277** apenas como metadados (binários,
  bundles de terceiros, mapas de source) e **196** foram excluídos com
  justificativa (quase todos internos do `.git`).
- **Duas famílias de repositórios que são quase idênticas**: `sigo-clinicas-*`
  (produto principal) e `bedin-*` (cópia white-label — ver abaixo).

## Os 7 repositórios e suas responsabilidades

| # | Repositório | Papel | Stack | Estado |
|---|---|---|---|---|
| 1 | **sigo-clinicas-api** | API REST central (backend, banco, auth, e-mail, uploads) | PHP 7.3 · Zend Framework 3 / Apigility · Doctrine ORM · OAuth2 · MySQL | **Produção** (`v1.6.8`) |
| 2 | **sigo-clinicas-painel** | Painel administrativo/ERP das clínicas (agenda, prontuário, orçamentos, vendas, financeiro) | React 16 · CRA v1 · Redux/Saga · Ant Design 3 + MUI · CASL | **Produção** (`v1.4.4`) |
| 3 | **sigo-clinicas-www** | Site público: marketplace de busca/agendamento + captação de clínicas + área do cliente | Next.js 7 (SSR) · React 16 · Ant Design 3 · Redux/Saga | **Produção** (`v1.3`) |
| 4 | **sigo-clinicas-app** | App mobile — **boilerplate abandonado**, sem features de clínica | Flutter (canal beta, Dart pré-null-safety) · MobX | **Scaffolding / abandonado** |
| 5 | **bedin-api** | Cópia **byte-a-byte** de `sigo-clinicas-api` (mesmo commit) | idem | Espelho white-label |
| 6 | **bedin-painel** | Cópia **byte-a-byte** de `sigo-clinicas-painel` (mesmo commit) | idem | Espelho white-label |
| 7 | **bedin-www** | Fork de `sigo-clinicas-www` + **1 commit** que troca a marca visível para **"HairBe"** | idem www | Rebrand incompleto |

### A relação "bedin" ↔ "sigo-clinicas" (fato confirmado)

- `bedin-api` ≡ `sigo-clinicas-api` e `bedin-painel` ≡ `sigo-clinicas-painel`:
  **trees idênticos, mesmo commit, mesmo histórico** (`diff -rq` vazio).
- `bedin-www` parte exatamente do HEAD de `sigo-clinicas-www` e adiciona um
  único commit ("ajustes iniciais", 2023-11-17) que substitui o nome exibido
  "SigoClínicas" por **"HairBe"** em títulos e termos de uso e sobe o Node de
  10→20. **Toda a infraestrutura (API, CI/CD, Docker, ECR) continua apontando
  para `sigoclinicas.com.br`** — o rebrand é cosmético e incompleto.
- Conclusão (inferência forte): **"bedin" é uma instância white-label / de
  cliente** da plataforma Sigo Clínicas, provavelmente para o vertical de
  beleza/estética (marca "HairBe"). A string "bedin" **não aparece dentro de
  nenhum arquivo** — é apenas o nome dos repositórios.

## O que enviar ao Claude Chat, e em que ordem

Para não estourar o limite de upload, o conteúdo foi particionado. Envie nesta
ordem:

1. **`xml/00-seguro-clinicas-master-index.xml`** — índice mestre (sempre primeiro).
2. **`docs/01-visao-geral-do-sistema.md`** e **`docs/02-mapa-de-repositorios.md`** —
   o modelo mental em prosa.
3. **`xml/01-sigo-clinicas-api-parte-001.xml`** — o backend é o centro de tudo;
   entenda a API antes dos frontends.
4. **`xml/03-sigo-clinicas-www-parte-001.xml`** e
   **`xml/02-sigo-clinicas-painel-parte-001.xml`** — os dois frontends reais.
5. **`xml/04-sigo-clinicas-app-parte-001.xml`** — o app (pequeno; opcional).
6. **`xml/05..07-bedin-*`** — **opcional e redundante**: 5 e 6 são cópias exatas
   de 1 e 2; só envie o 07 (bedin-www) se precisar comparar o rebrand HairBe.

> Se o objetivo for compreender o sistema, **os repositórios `sigo-clinicas-*`
> bastam**. Os `bedin-*` só importam para a discussão de white-label.

## Limitações desta análise

- **Snapshot estático**: reflete os commits atuais (backend `3c219a4`,
  painel `242692b`, www `f7cddec`), todos de **2022**. O sistema não foi
  executado; comportamento em runtime não foi observado.
- **Extração heurística**: as listas de endpoints, variáveis de ambiente e
  objetos de banco vêm de regex sobre o código e das coleções Postman — são um
  bom mapa, mas podem ter omissões ou falsos positivos.
- **Detecção de segredos é heurística**: pode ter falsos positivos (ex.: hashes
  de `package-lock.json`, mapa `$fa-var-*` do Font Awesome) e potenciais
  falsos negativos. Ver `security/potential_secrets_report.md`.
- **Não há acesso ao banco de produção**: o schema documentado vem do
  `assets/mysql/dump.sql` versionado, que é um bootstrap manual e diverge em
  pontos do mapeamento Doctrine (documentado em `04-banco-de-dados.md`).

## Alertas importantes

- 🔴 **Segredos versionados**: chaves AWS e credenciais SMTP do Amazon SES estão
  **hardcoded** em `sigo-clinicas-api/Dockerfile` e `docker-compose.yml`
  (e nas cópias `bedin-api`). Uma **Google API Key** está em
  `*-painel/apiGoogleconfig.json`. Estão redigidas nos XMLs, mas **existem em
  claro nos repositórios reais** — recomenda-se rotação e limpeza de histórico.
- 🔴 **Stack inteira em EOL**: PHP 7.3, Zend/Apigility, MySQL 5.6, Next 7,
  React 16, CRA v1, Flutter pré-null-safety.
- 🟠 **CORS `*` em produção** na API, com header `Authorization` permitido.
- 🟠 **Autorização de frontend é puramente client-side** (CASL em localStorage);
  a segurança real depende inteiramente da API.
- Ver a lista completa e priorizada em `docs/09-riscos-dividas-e-inconsistencias.md`.

## Estrutura deste pacote

```
_seguro_clinicas_context/
├── tools/build_context.py         # gerador determinístico (reexecutável)
├── xml/                           # índice mestre + 1 parte por repositório
├── docs/                          # 00..10 — esta documentação
├── diagrams/                      # diagramas Mermaid
├── inventory/                     # CSVs + audit-report.md (reconciliação)
└── security/                      # potential_secrets_report.md
```

Para regenerar tudo: `py _seguro_clinicas_context/tools/build_context.py`
(não modifica nenhum repositório).
