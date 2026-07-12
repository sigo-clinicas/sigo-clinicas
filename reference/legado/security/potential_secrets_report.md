# Relatório de possíveis segredos detectados

Total de ocorrências redigidas: **39**

Os valores NÃO são reproduzidos aqui nem nos XMLs — foram substituídos por `[REDACTED_SECRET]`/`[REDACTED]`. Os arquivos originais dos repositórios não foram modificados.

| Repositório | Arquivo | Linha | Tipo |
|---|---|---|---|
| bedin-api | Dockerfile | 95 | aws-access-key-id |
| bedin-api | Dockerfile | 96 | config-word-credential |
| bedin-api | assets/mysql/dump.sql | 67 | bcrypt-hash |
| bedin-api | assets/mysql/dump.sql | 90 | bcrypt-hash |
| bedin-api | config/autoload/doctrine.global-development.php | 11 | keyword-assignment |
| bedin-api | docker-compose.yml | 20 | aws-access-key-id |
| bedin-painel | .env | 1 | dotenv-value |
| bedin-painel | apiGoogleconfig.json | 3 | google-api-key |
| bedin-painel | apiGoogleconfig.json | 3 | keyword-assignment |
| bedin-painel | package-lock.json | 7843 | keyword-assignment |
| bedin-painel | package-lock.json | 14537 | keyword-assignment |
| bedin-painel | package-lock.json | 16027 | keyword-assignment |
| bedin-painel | public/resources/fonts/font-awesome/less/variables.less | 746 | keyword-assignment |
| bedin-painel | public/resources/fonts/font-awesome/scss/_variables.scss | 746 | keyword-assignment |
| bedin-painel | src/components/LayoutComponents/Page/index.js | 89 | env-style-credential |
| bedin-www | components/LoginComponent/index.js | 26 | keyword-assignment |
| bedin-www | package-lock.json | 8187 | keyword-assignment |
| bedin-www | package-lock.json | 21426 | keyword-assignment |
| sigo-clinicas-api | Dockerfile | 95 | aws-access-key-id |
| sigo-clinicas-api | Dockerfile | 96 | config-word-credential |
| sigo-clinicas-api | assets/mysql/dump.sql | 67 | bcrypt-hash |
| sigo-clinicas-api | assets/mysql/dump.sql | 90 | bcrypt-hash |
| sigo-clinicas-api | config/autoload/doctrine.global-development.php | 11 | keyword-assignment |
| sigo-clinicas-api | docker-compose.yml | 20 | aws-access-key-id |
| sigo-clinicas-app | lib/data/sharedpref/constants/preferences.dart | 5 | keyword-assignment |
| sigo-clinicas-app | lib/stores/form/form_store.dart | 96 | keyword-assignment |
| sigo-clinicas-app | lib/utils/encryption/xxtea.dart | 57 | keyword-assignment |
| sigo-clinicas-painel | .env | 1 | dotenv-value |
| sigo-clinicas-painel | apiGoogleconfig.json | 3 | google-api-key |
| sigo-clinicas-painel | apiGoogleconfig.json | 3 | keyword-assignment |
| sigo-clinicas-painel | package-lock.json | 7843 | keyword-assignment |
| sigo-clinicas-painel | package-lock.json | 14537 | keyword-assignment |
| sigo-clinicas-painel | package-lock.json | 16027 | keyword-assignment |
| sigo-clinicas-painel | public/resources/fonts/font-awesome/less/variables.less | 746 | keyword-assignment |
| sigo-clinicas-painel | public/resources/fonts/font-awesome/scss/_variables.scss | 746 | keyword-assignment |
| sigo-clinicas-painel | src/components/LayoutComponents/Page/index.js | 89 | env-style-credential |
| sigo-clinicas-www | components/LoginComponent/index.js | 26 | keyword-assignment |
| sigo-clinicas-www | package-lock.json | 8187 | keyword-assignment |
| sigo-clinicas-www | package-lock.json | 21426 | keyword-assignment |