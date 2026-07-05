## Why

The app builds and ships three Docker images per push to `main` (`.github/workflows/main.yml` → GHCR, tagged `latest` + `sha-<sha>`), but nothing consumes them: there is no way to actually run Readion in production. The `k8s/` directory is a single `README.md` placeholder, and that placeholder is **stale** — it plans a Postgres `StatefulSet` and a Redis `Deployment`, which directly contradicts `SPEC.md` → Infrastructure (Postgres and Redis are **managed external** services in production, referenced only by connection string).

This change adds the production deployment layer: per-app Kubernetes manifests, config/secret wiring sourced from each app's `.env.example`, the MikroORM migration `Job` that runs before app pods start, and the ArgoCD + Image Updater GitOps glue that turns a new image digest into a rollout. It is the last piece of `SPEC.md` → Infrastructure that isn't yet built, and it depends only on `scaffold-monorepo` (Dockerfiles, CI image build/push) and `observability` (health/metrics endpoints used as probes) — both archived.

Scope is deliberately **infra-as-config only**: YAML manifests and a validation harness. No new entities, no migrations authored here (this only *runs* the migrations `packages/db` already owns), no application code, no `packages/db` **source** changes. The one deliberate reach beyond `k8s/`, flagged in `design.md` → Decisions/Risks, is a minimal Dockerfile/CI addition to build and push a migration image that bundles the already-compiled `packages/db` migrations + MikroORM config (the current api/worker runner stages omit them) — see `tasks.md` task 5.2.

## What Changes

- **Per-app workloads** (`SPEC.md` → Infrastructure → Kubernetes):
  - `apps/api` — `Deployment` + `ClusterIP` `Service`; `GET /health` (terminus) as liveness/readiness probe.
  - `apps/web` — `Deployment` + `Service` + `Ingress` (TLS termination + public host; CORS origin already set from the app's public domain per `SPEC.md` → CORS).
  - `apps/worker` — `Deployment`, **no** `Service`/`Ingress`, with the **`amerkurev/scrapper` as a sidecar container in the worker pod** (reached over `localhost`). This differs from the docker-compose dev stack, where scrapper is a standalone service — in production there is **no** separate scrapper `Deployment`.
- **External managed data stores** — Postgres (Cloud SQL / Neon / RDS with pgvector) and Redis (Upstash / Redis Cloud) are referenced **only** via `Secret` connection strings. **No** `StatefulSet`/`Deployment` for either. The stale `k8s/README.md` `base/postgres/` + `base/redis/` bullets are removed/rewritten.
- **Config & secrets** — non-sensitive env → `ConfigMap`; sensitive values → `Secret`. The authoritative key list is each app's `apps/{api,web,worker}/.env.example`; keys are partitioned into config vs secret in `design.md`.
- **Database migration `Job`** (`SPEC.md` → Infrastructure → Database Migrations) — a `Job` runs `mikro-orm migration:up` against the production database, wired as an **ArgoCD `pre-sync` hook** so it completes **before** the new API and worker pods roll. A migration failure fails the sync and blocks the rollout.
- **GitOps** — an ArgoCD `Application` tracking `k8s/`, with **ArgoCD Image Updater** annotations pointing at the GHCR images that `.github/workflows/main.yml` already pushes, watching the `latest`/`sha-*` tags for digest changes to trigger a rollout.
- **Validation harness** — since this is YAML, the "test" is manifest validation: `kustomize build` + `kubeconform` (schema-valid) plus assertions that the required resources/kinds exist and the invariants above hold (worker has a scrapper sidecar and no scrapper Service; no Postgres/Redis workload; migration Job carries the `pre-sync` hook).
- **Docs** — replace the stale `k8s/README.md` with an accurate operator-facing description of the real topology.

## Capabilities

### New Capabilities
- `kubernetes-deployment`: the per-app `Deployment`/`Service`/`Ingress` topology, the worker+scrapper sidecar pod, external-managed Postgres/Redis references, `ConfigMap`/`Secret` config wiring, health probes, and the ArgoCD + Image Updater GitOps glue — the manifests that run Readion in production.
- `db-migration-job`: the MikroORM migration `Job` (`mikro-orm migration:up`) run as an ArgoCD `pre-sync` hook, ordered before API/worker pods and gating the rollout on migration success.

### Modified Capabilities
<!-- None — this change introduces the deployment layer; it does not alter existing app/spec behavior. -->

## Impact

- **Creates** the real `k8s/` manifest tree (per `design.md` layout) and a manifest-validation test; **replaces** the stale `k8s/README.md` placeholder.
- **No entities, no migrations, no `packages/db` changes** — this change *runs* migrations `db-foundation`/feature changes already own; it authors none. See `openspec/IMPLEMENTATION-ORDER.md` → Entity ownership.
- **Consumes** existing artifacts: the three app Dockerfiles and the `main.yml` image build/push (`scaffold-monorepo`) and `GET /health` + `/metrics` (`observability`) are reused as-is, **except** for the one flagged migration-image addition — a small Dockerfile/CI change to build/push an image that bundles the compiled `packages/db` migrations + MikroORM config (no `packages/db` source change). See `design.md` → Decisions/Risks and `tasks.md` task 5.2.
- **Depends on** `scaffold-monorepo` and `observability` (both archived). Logically sequenced after all feature work so the deployed image set is complete, but has no code dependency on feature changes.
- **Cross-cutting deliverables**: none attributed to this change — the worker crons and feature-emitted metrics in `openspec/IMPLEMENTATION-ORDER.md` belong to their owning feature changes; this change only provides the runtime they execute in.
- **Operational prerequisites introduced** (documented, provisioned out-of-band): a managed Postgres-with-pgvector instance, a managed Redis, a container registry pull secret for GHCR, an Ingress controller + TLS, and an ArgoCD install with Image Updater.
