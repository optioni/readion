## Context

`SPEC.md` → Infrastructure fixes the production shape: three per-app workloads on Kubernetes, Postgres and Redis as **managed external** services, MikroORM migrations as a `Job` gated by an ArgoCD `pre-sync` hook, and GitOps via ArgoCD + Image Updater watching GHCR. The Dockerfiles and the `main.yml` build/push already exist (`scaffold-monorepo`); `GET /health` (terminus) and `/metrics` already exist (`observability`). What's missing is the k8s side.

Two things in the current repo are **wrong or thin** and this change corrects them:
1. `k8s/README.md` plans a Postgres `StatefulSet` and Redis `Deployment` — contradicting the managed-external decision in `SPEC.md`. Treated as stale; rewritten.
2. The migration `Job` needs an image that contains the **compiled `packages/db` migrations + the MikroORM config/CLI**. The current `apps/api` / `apps/worker` runner Docker stages copy only `node_modules` + that app's `dist` — they do **not** copy `packages/db` migration files. See Decisions → "Migration Job image".

This is infra-as-config: the deliverable is YAML plus a validation harness, not application code.

## Goals / Non-Goals

**Goals:**
- Manifests that deploy api (ClusterIP), web (Ingress), and worker (scrapper sidecar, no ingress) from the already-pushed GHCR images.
- Postgres/Redis referenced only by `Secret` connection string — no in-cluster data-store workload.
- Config split into `ConfigMap` (non-secret) and `Secret` (secret), keyed off each app's `.env.example`.
- A migration `Job` running `mikro-orm migration:up` as a `pre-sync` hook, ordered before app pods and gating rollout.
- ArgoCD `Application` + Image Updater annotations that roll on a GHCR digest change to `latest`/`sha-*`.
- A manifest-validation harness (schema-valid + invariant assertions) as the acceptance gate.

**Non-Goals:**
- Any application/entity/migration code or `packages/db` changes (this change *runs* migrations, authors none).
- Provisioning the managed Postgres/Redis, the cluster, the Ingress controller/TLS, or installing ArgoCD itself — these are operational prerequisites, documented not codified here.
- HPA/autoscaling, network policies, service mesh, multi-region, per-env promotion pipelines — out of scope for the first deployment layer (can be layered on later).
- Changing `main.yml`'s tag strategy — it already emits `latest` + `sha-*`, which is what Image Updater watches.

## Decisions

- **Managed-external Postgres & Redis, referenced by `Secret` only.** `SPEC.md` → Infrastructure is explicit (Cloud SQL/Neon/RDS-with-pgvector, Upstash/Redis Cloud). No `StatefulSet`/`Deployment` for either; the stale `k8s/README.md` bullets are removed. `DATABASE_URL` and `REDIS_URL` live in the `Secret`.
- **Scrapper as a worker-pod sidecar, not a `Deployment`.** `SPEC.md` → Scrapper Sidecar + Infrastructure table. The worker pod runs two containers (worker + `amerkurev/scrapper`); the worker reaches it on `localhost`, so `SCRAPPER_URL` in production is `http://localhost:<scrapper-port>`. There is **no** scrapper `Service` and **no** standalone scrapper `Deployment` — this is the intended divergence from the docker-compose dev stack.
- **Migration Job as an ArgoCD `pre-sync` hook.** `SPEC.md` → Database Migrations. Annotated `argocd.argoproj.io/hook: PreSync` so it runs to completion (and its success gates) before the api/worker `Deployment`s roll. Hook-delete policy set so a prior Job doesn't block re-sync. Covered by the `db-migration-job` capability.
- **Migration Job image bundles `packages/db`.** The Job runs `mikro-orm migration:up`, which needs the compiled migrations + MikroORM config, which the current `apps/api`/`apps/worker` runner stages do not include. Resolve by adding a small **`packages/db` migration image** (or extending an existing app image's runner stage to copy `packages/db` dist + the MikroORM config and expose the CLI). Pin the Job to the same `sha-*` digest as the app rollout so schema and code move together. **This requires a Dockerfile/CI touch and must be settled during implementation — flagged as the main cross-artifact risk.**
- **GitOps: ArgoCD `Application` + Image Updater watching GHCR.** Image Updater annotations reference `ghcr.io/<repo>/{api,web,worker}` and track the `latest`/`sha-*` tags `main.yml` already pushes; a digest change triggers the rollout. A GHCR image-pull `Secret` is referenced by each workload.
- **Config vs Secret partition, sourced from `.env.example`.** Authoritative key list is each app's `.env.example`. Partition:
  - **`Secret`** (sensitive): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `INTERNAL_API_SECRET`, `SENTRY_DSN`, plus any AI/web-search provider API keys when those land in the app config schema.
  - **`ConfigMap`** (non-sensitive): `PORT`, `NODE_ENV`, `SERVICE_NAME`, `CORS_ORIGIN`, `WEB_BASE_URL`/`PUBLIC_API_URL`, `MAIL_FROM`, `SCRAPPER_URL`, `INTERNAL_API_BASE_URL`, `LOG_LEVEL`, `PROMETHEUS_PORT`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and the numeric tuning knobs (coverage thresholds, readiness/diagnostic/summary/analytics/lifecycle windows). `SMTP_HOST`/`SMTP_PORT` are config; credentials are secret.
  - `apps/web` needs only `NODE_ENV` + `NUXT_PUBLIC_API_BASE_URL` (public origin) → `ConfigMap`.
- **Health probes.** api liveness+readiness → `GET /health` (terminus, from `observability`). web readiness → HTTP GET on its port. worker has **no HTTP server**, so it uses no HTTP probe — an `exec`/process-liveness probe (or none) rather than a fabricated endpoint.
- **Validation as the acceptance gate.** No Vitest/Testcontainers fit here. The gate is `kustomize build k8s/... | kubeconform -strict` (schema validity) plus assertions over the built output for the invariants (worker pod has a scrapper sidecar and no scrapper Service; no Postgres/Redis workload; migration Job carries the `PreSync` hook; each workload references the ConfigMap+Secret). Wired as a repo script so CI can run it; deliberately **not** shoehorned into the Testcontainers harness.

## Manifest layout (planned)

```
k8s/
  base/
    api/         deployment.yaml, service.yaml
    web/         deployment.yaml, service.yaml, ingress.yaml
    worker/      deployment.yaml            # worker + scrapper sidecar, no service
    migrations/  job.yaml                   # PreSync hook, mikro-orm migration:up
    config/      configmap.yaml, secret.example.yaml   # secret is an example; real values out-of-band
    kustomization.yaml
  argocd/
    application.yaml                        # + Image Updater annotations
  README.md                                 # rewritten: real topology, managed-external DB/Redis
```

(Exact kustomize base/overlay split can be refined in implementation; overlays are optional for the first cut.)

## Test Boundaries

Infra YAML is validated by building and schema-checking it, not by unit tests. Live cluster / ArgoCD / managed DB are **not** stood up in the acceptance gate — they are operational prerequisites.

| Dependency | In acceptance (validation) | Notes |
|---|---|---|
| Manifest schema validity | real — `kustomize build` + `kubeconform -strict` | catches malformed/unknown kinds |
| Topology invariants | real — assertions over built manifest output | sidecar present, no scrapper/Postgres/Redis workload, PreSync hook present |
| GHCR images | referenced, not pulled | built/pushed by `main.yml` already |
| Live Kubernetes cluster | **not** in gate | applied by ArgoCD in a real environment |
| ArgoCD + Image Updater | **not** in gate | manifest correctness validated; rollout behavior is operational |
| Managed Postgres / Redis | **not** in gate | external; connection via `Secret` at deploy time |
| Migration `Job` execution | **not** in gate | runs against the real prod DB during sync |

## Risks / Trade-offs

- **Migration Job image doesn't exist yet.** The api/worker runner stages omit `packages/db` migrations → the `Job` can't `migration:up` as-is. → Add a dedicated migration image (or extend a runner stage to copy `packages/db` dist + MikroORM config) and build/push it in CI; pin the Job to the app `sha-*` digest. Flagged to the orchestrator as the one place this change reaches beyond `k8s/`.
- **Secrets in Git.** Only a `secret.example.yaml` (placeholder keys) is committed; real values are supplied out-of-band (sealed-secrets / external-secrets / cluster-managed). → Document this; never commit real secret material.
- **Image Updater write-back.** Image Updater can write the resolved digest back to Git or patch live — pick the write-back method (git vs argocd) and ensure it targets `latest`/`sha-*` as pushed by `main.yml`. → Document the chosen strategy in `argocd/application.yaml`.
- **Validation tooling availability in CI.** `kustomize` + `kubeconform` must be installed in the validation job. → Install them in the script/CI step; keep them out of the app Testcontainers path.
- **`SPEC.md` CI/CD wording says "tag with the branch name (e.g. `main`)"**, but the implemented `main.yml` tags `latest` + `sha-*`. These are compatible (`latest` == the main-branch head), and the authoritative guidance is to watch `latest`/`sha-*`. → No `main.yml` change; noted so the discrepancy isn't re-litigated.

## Open Questions

- **Migration image**: dedicated `packages/db` image vs extending the api runner stage? (Leaning: dedicated migration image, smallest blast radius.)
- **Kustomize overlays**: single base vs base+prod overlay for the first cut? (Doesn't block; base-only is acceptable initially.)
- **Secret management backend**: sealed-secrets vs external-secrets vs cloud secret store? (Operational; only the reference shape is committed.)
- **Ingress controller & TLS issuer**: nginx + cert-manager vs cloud-native ingress? (Environment-specific; Ingress manifest stays controller-agnostic where possible.)
