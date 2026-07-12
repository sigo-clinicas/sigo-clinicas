# Diagrama — Repositórios e integrações (famílias sigo e bedin)

```mermaid
graph LR
    subgraph SIGO["Família sigo-clinicas (produto principal)"]
        SAPI["sigo-clinicas-api<br/>3c219a4 · v1.6.8"]
        SPAI["sigo-clinicas-painel<br/>242692b · v1.4.4"]
        SWWW["sigo-clinicas-www<br/>f7cddec · v1.3"]
        SAPP["sigo-clinicas-app<br/>fa8643b (abandonado)"]
    end

    subgraph BEDIN["Família bedin (white-label 'HairBe')"]
        BAPI["bedin-api<br/>3c219a4 (idêntico)"]
        BPAI["bedin-painel<br/>242692b (idêntico)"]
        BWWW["bedin-www<br/>2ddd102 (fork +1 commit)"]
    end

    SPAI -->|REST/OAuth2| SAPI
    SWWW -->|REST/OAuth2| SAPI
    SAPP -.->|não integra| SAPI

    BPAI -.->|inferido: REST/OAuth2| BAPI
    BWWW -->|CONFIRMADO: aponta<br/>p/ *.sigoclinicas.com.br| SAPI

    BAPI -.->|cópia byte-a-byte| SAPI
    BPAI -.->|cópia byte-a-byte| SPAI
    BWWW -.->|fork + rebrand HairBe| SWWW

    classDef mirror fill:#f5f5ff,stroke:#88a;
    class BAPI,BPAI,BWWW mirror;
```

**Notas de evidência**
- `bedin-api ≡ sigo-clinicas-api` e `bedin-painel ≡ sigo-clinicas-painel`:
  `diff -rq` vazio, mesmo commit/histórico.
- `bedin-www`: fork linear de `sigo-clinicas-www` + 1 commit ("ajustes iniciais")
  que troca marca visível → "HairBe" e sobe Node 10→20; **API/CI/Docker
  permanecem sigoclinicas** → risco de deploy cruzado (ver `docs/09` R9).
