# Relatório de auditoria da geração de contexto

- Gerado em: 2026-07-11T19:28:07.086222+00:00
- Gerador: build_context.py v1.0.0
- Raiz: `C:\Users\neemi\sigo-clinicas\repositorio-antigo`

## Reconciliação matemática

`4054 descobertos = 3581 integrais + 277 somente-metadados + 196 excluídos` → **OK**

## Totais por repositório

| Repositório | Descobertos | Integral | Metadados | Excluídos | Rastreados (git) | Rastreados representados |
|---|---|---|---|---|---|---|
| sigo-clinicas-api | 323 | 293 | 2 | 28 | 295 | 295 |
| sigo-clinicas-painel | 1391 | 1293 | 70 | 28 | 1363 | 1363 |
| sigo-clinicas-www | 191 | 114 | 49 | 28 | 163 | 163 |
| sigo-clinicas-app | 244 | 181 | 35 | 28 | 216 | 216 |
| bedin-api | 323 | 293 | 2 | 28 | 295 | 295 |
| bedin-painel | 1391 | 1293 | 70 | 28 | 1363 | 1363 |
| bedin-www | 191 | 114 | 49 | 28 | 163 | 163 |

## Arquivos rastreados não representados

Nenhum. Todos os arquivos rastreados por git estão representados no inventário.

## Validação dos XMLs

| XML | Resultado | Erro |
|---|---|---|
| 01-sigo-clinicas-api-parte-001.xml | OK |  |
| 02-sigo-clinicas-painel-parte-001.xml | OK |  |
| 03-sigo-clinicas-www-parte-001.xml | OK |  |
| 04-sigo-clinicas-app-parte-001.xml | OK |  |
| 05-bedin-api-parte-001.xml | OK |  |
| 06-bedin-painel-parte-001.xml | OK |  |
| 07-bedin-www-parte-001.xml | OK |  |
| 00-seguro-clinicas-master-index.xml | OK |  |

## XML consolidado único

Não gerado: a soma das partes (25,472,578 bytes) excede o limite configurado de 8,388,608 bytes por arquivo. O conteúdo integral está preservado nas partes numeradas — nada foi resumido ou omitido.

## Possíveis repositórios duplicados

- Commit `3c219a4765f3` compartilhado por: sigo-clinicas-api, bedin-api → **duplicação confirmada**
- Commit `242692b648c9` compartilhado por: sigo-clinicas-painel, bedin-painel → **duplicação confirmada**

## Arquivos grandes (> 1 MB)

| Repositório | Arquivo | Bytes | Decisão |
|---|---|---|---|
| sigo-clinicas-www | static/antd/antd-with-locales.js | 5,862,027 | metadata-only |
| bedin-www | static/antd/antd-with-locales.js | 5,862,027 | metadata-only |
| sigo-clinicas-www | static/antd/antd-with-locales.min.js.map | 5,736,218 | metadata-only |
| bedin-www | static/antd/antd-with-locales.min.js.map | 5,736,218 | metadata-only |
| sigo-clinicas-www | static/antd/antd.js | 5,633,975 | metadata-only |
| bedin-www | static/antd/antd.js | 5,633,975 | metadata-only |
| sigo-clinicas-www | static/antd/antd.min.js.map | 5,563,022 | metadata-only |
| bedin-www | static/antd/antd.min.js.map | 5,563,022 | metadata-only |
| sigo-clinicas-www | static/antd/antd-with-locales.js.map | 5,159,676 | metadata-only |
| bedin-www | static/antd/antd-with-locales.js.map | 5,159,676 | metadata-only |
| sigo-clinicas-www | static/antd/antd.js.map | 4,975,138 | metadata-only |
| bedin-www | static/antd/antd.js.map | 4,975,138 | metadata-only |
| sigo-clinicas-www | static/landingpage/banner-rodape.png | 2,681,657 | metadata-only |
| bedin-www | static/landingpage/banner-rodape.png | 2,681,657 | metadata-only |
| sigo-clinicas-www | static/antd/antd-with-locales.min.js | 1,944,133 | metadata-only |
| bedin-www | static/antd/antd-with-locales.min.js | 1,944,133 | metadata-only |
| sigo-clinicas-www | static/antd/antd.min.js | 1,862,915 | metadata-only |
| bedin-www | static/antd/antd.min.js | 1,862,915 | metadata-only |
| sigo-clinicas-app | assets/images/img_login.jpg | 1,393,730 | metadata-only |
| sigo-clinicas-www | static/landingpage/banner-header.png | 1,164,690 | metadata-only |
| bedin-www | static/landingpage/banner-header.png | 1,164,690 | metadata-only |
| sigo-clinicas-www | package-lock.json | 1,066,004 | full-content |
| bedin-www | package-lock.json | 1,066,004 | full-content |

## Arquivos representados apenas por metadados

Total: 277. Lista completa em `inventory/metadata-only-files.csv`.

## Possíveis segredos

39 ocorrências redigidas — ver `security/potential_secrets_report.md`.

## Duplicação de arquivos entre repositórios

- 1092 arquivos idênticos compartilhados entre: bedin-painel, sigo-clinicas-painel
- 292 arquivos idênticos compartilhados entre: bedin-api, sigo-clinicas-api
- 140 arquivos idênticos compartilhados entre: bedin-www, sigo-clinicas-www
- 1 arquivos idênticos compartilhados entre: bedin-api, sigo-clinicas-api, sigo-clinicas-app
- 1 arquivos idênticos compartilhados entre: bedin-painel, bedin-www, sigo-clinicas-app, sigo-clinicas-painel, sigo-clinicas-www
- 1 arquivos idênticos compartilhados entre: bedin-painel, bedin-www, sigo-clinicas-painel, sigo-clinicas-www

## Nível de confiança da geração

Alto: reconciliação matemática verificada por assert, todos os arquivos rastreados representados, XMLs validados por parser. Limitações: extração de endpoints/variáveis é heurística (regex); detecção de segredos é heurística e pode ter falsos positivos/negativos.