# Diagrama — Fluxo de autenticação (OAuth2 password grant)

```mermaid
sequenceDiagram
    participant U as Usuário (browser)
    participant F as Frontend (www / painel)
    participant API as sigo-clinicas-api
    participant DB as MySQL (oauth2_*, user, role)

    U->>F: e-mail + senha
    F->>API: POST /oauth (grant_type=password,<br/>client_id=<email>, username, password)
    API->>DB: valida credenciais (bcrypt) e client
    DB-->>API: user + tokens
    API-->>F: access_token + refresh_token + expires_in
    F->>API: GET /user-roles (Bearer access_token)
    API-->>F: papéis do usuário
    Note over F: www: grava em cookies (js-cookie)<br/>painel: grava em localStorage + monta CASL

    rect rgb(245,235,235)
    Note over F,API: Requisições subsequentes
    F->>API: GET/POST /clinicas/:clinica/... (Bearer)
    API->>API: zf-mvc-auth valida token
    API->>API: AuthenticationListener:<br/>usuário pertence à clínica? senão 403
    API->>API: AuthorizationListener:<br/>papel pode método+recurso? senão 403
    API-->>F: recurso HAL/JSON ou API-Problem
    end

    Note over F: painel: refresh via grant_type=refresh_token<br/>www: refresh salvo mas NUNCA usado (re-login ~30min)
```

**Fronteira de confiança**: a autorização do painel (CASL em localStorage) é
apenas UX. A decisão real de acesso está **inteiramente na API**
(`AuthorizationListener` + `AuthenticationListener`). Ver `docs/06`.
