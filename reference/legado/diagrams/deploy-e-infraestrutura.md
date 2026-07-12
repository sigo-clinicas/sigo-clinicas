# Diagrama — Deploy e infraestrutura (AWS us-east-1)

```mermaid
graph TD
    subgraph GitLab["GitLab CI (por branch: develop/homolog/master)"]
        CIAPI["api: docker build → ECR → ecs update-service"]
        CIPAI["painel: npm build → s3 cp → cloudfront invalidation"]
        CIWWW["www: docker build → ECR → ECS service"]
    end

    subgraph AWS["AWS us-east-1 · conta 304789899667"]
        ECRAPI[("ECR<br/>api.sigoclinicas.com.br")]
        ECRWWW[("ECR<br/>www.sigoclinicas.com.br")]
        ECS["ECS cluster 'zeus'<br/>+ ALB (host-header)<br/>autoscaling 2–4 tasks"]
        S3APP[("S3<br/>app.sigoclinicas.com.br<br/>(painel estático)")]
        S3ASSETS[("S3<br/>assets.* (uploads)")]
        CF["CloudFront + ACM"]
        RDS[("RDS MySQL<br/>addpix.*.rds.amazonaws.com")]
        SES["SES"]
        R53["Route53<br/>*.sigoclinicas.com.br"]
    end

    CIAPI --> ECRAPI --> ECS
    CIWWW --> ECRWWW --> ECS
    CIPAI --> S3APP --> CF
    ECS --> RDS
    ECS --> S3ASSETS
    ECS --> SES
    CF --> R53
    ECS --> R53

    subgraph Ambientes["3 ambientes"]
        DEV["dev-api / dev-app"]
        HOM["homolog-api / homolog-app"]
        PRD["api / app (produção)"]
    end
```

**Divergências/alertas (ver docs/07 e docs/09)**
- `cloudformation.yaml` usa `sigoclinicas.com`; CI/e-mails usam
  `sigoclinicas.com.br`.
- Painel é **estático (S3+CloudFront)**; site e API rodam em **container ECS**.
- Segredos AWS/SES **hardcoded** em `Dockerfile`/`docker-compose.yml` da API.
- `bedin-www` publicaria nesta **mesma** infra sigoclinicas (pipeline não
  ajustado) — risco de deploy cruzado.
- Observabilidade e rollback: **não versionados** (health check ALB em `/`).
