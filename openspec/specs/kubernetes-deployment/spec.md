# kubernetes-deployment

## Purpose

Defines the production Kubernetes deployment layer for Readion: the per-app `Deployment`/`Service`/`Ingress` topology, the worker pod with its `amerkurev/scrapper` sidecar, external-managed Postgres/Redis references, `ConfigMap`/`Secret` config wiring, health probes, and the ArgoCD + Image Updater GitOps glue that turns a new image digest into a rollout — the manifests that run Readion in production.

## Requirements

### Requirement: Per-app Kubernetes workloads

Each application SHALL be deployed as its own Kubernetes workload from the GHCR image built by `.github/workflows/main.yml`: `apps/api` as a `Deployment` fronted by a `ClusterIP` `Service`; `apps/web` as a `Deployment` fronted by a `Service` and exposed via an `Ingress`; `apps/worker` as a `Deployment` with **no** `Service` and **no** `Ingress`.

#### Scenario: API is a Deployment behind a ClusterIP Service

- **WHEN** the base manifests are built
- **THEN** an `apps/api` `Deployment` and a `ClusterIP` `Service` targeting it exist
- **AND** the api container references the GHCR api image and a registry pull secret

#### Scenario: Web is a Deployment exposed via Ingress

- **WHEN** the base manifests are built
- **THEN** an `apps/web` `Deployment`, its `Service`, and an `Ingress` routing the public host to that `Service` exist
- **AND** the `Ingress` is configured to terminate TLS for the app's public domain

#### Scenario: Worker is a Deployment with no ingress

- **WHEN** the base manifests are built
- **THEN** an `apps/worker` `Deployment` exists and there is no `Service` or `Ingress` targeting the worker

### Requirement: Scrapper runs as a sidecar in the worker pod

The `amerkurev/scrapper` service SHALL run as a sidecar container inside the worker pod in production, reached by the worker over `localhost`. There SHALL be no standalone scrapper `Deployment` and no scrapper `Service`. This is a deliberate divergence from the docker-compose dev stack, where scrapper is a standalone service.

#### Scenario: Worker pod bundles the scrapper sidecar

- **WHEN** the worker `Deployment` pod spec is inspected
- **THEN** it declares two containers: the worker and the `amerkurev/scrapper` sidecar
- **AND** the worker's `SCRAPPER_URL` points at the sidecar over `localhost`

#### Scenario: No standalone scrapper workload exists

- **WHEN** the base manifests are built
- **THEN** no scrapper `Deployment` and no scrapper `Service` are present

### Requirement: Postgres and Redis are managed external services

PostgreSQL (with pgvector) and Redis SHALL be provisioned as managed external services and referenced only via connection strings held in a `Secret`. The manifests SHALL NOT include a `StatefulSet` or `Deployment` for PostgreSQL or Redis.

#### Scenario: No in-cluster data-store workload

- **WHEN** the base manifests are built
- **THEN** there is no `StatefulSet` or `Deployment` for PostgreSQL or Redis
- **AND** `DATABASE_URL` and `REDIS_URL` are supplied to the workloads from a `Secret`

### Requirement: Configuration via ConfigMap and Secret

Non-sensitive environment configuration SHALL be provided via a `ConfigMap` and sensitive values via a `Secret`, with the set of keys sourced from each app's `.env.example`. Sensitive values (database and Redis connection strings, `JWT_SECRET`, SMTP credentials, `INTERNAL_API_SECRET`, Sentry DSN, and any provider API keys) SHALL NOT appear in the `ConfigMap`. No real secret material SHALL be committed to the repository — only a placeholder example `Secret`.

#### Scenario: Sensitive keys are only in the Secret

- **WHEN** the config manifests are built
- **THEN** the `ConfigMap` contains the non-sensitive keys and none of the sensitive keys
- **AND** the sensitive keys are defined in the `Secret`

#### Scenario: Workloads consume both config sources

- **WHEN** a workload pod spec is inspected
- **THEN** it references the `ConfigMap` and the `Secret` for its environment

#### Scenario: No real secrets are committed

- **WHEN** the repository is inspected
- **THEN** the committed secret manifest contains only placeholder values, with real values supplied out-of-band

### Requirement: Health probes for liveness and readiness

The api `Deployment` SHALL use `GET /health` as its liveness and readiness probe. The web `Deployment` SHALL use an HTTP readiness probe on its serving port. The worker `Deployment`, which runs no HTTP server, SHALL NOT use an HTTP probe and SHALL instead rely on a process/exec-based liveness check or none.

#### Scenario: API probes hit /health

- **WHEN** the api `Deployment` is inspected
- **THEN** its liveness and readiness probes target `GET /health`

#### Scenario: Worker uses no HTTP probe

- **WHEN** the worker `Deployment` is inspected
- **THEN** it defines no HTTP liveness/readiness probe

### Requirement: GitOps rollout via ArgoCD and Image Updater

Deployment SHALL be driven by an ArgoCD `Application` tracking the `k8s/` manifests, with ArgoCD Image Updater configured to watch the GHCR images pushed by `.github/workflows/main.yml` (on the `latest`/`sha-*` tags) and trigger a rollout when a new image digest is detected.

#### Scenario: ArgoCD Application tracks the manifests

- **WHEN** the GitOps manifests are built
- **THEN** an ArgoCD `Application` references the `k8s/` base and carries Image Updater annotations for the api, web, and worker GHCR images

#### Scenario: A new image digest triggers a rollout

- **WHEN** `main.yml` pushes new `latest`/`sha-*` images and Image Updater detects the digest change
- **THEN** ArgoCD rolls the affected workloads to the new digest

### Requirement: Manifests are schema-valid and structurally correct

The `k8s/` manifests SHALL build via `kustomize` and pass strict schema validation (`kubeconform -strict`), and the built output SHALL satisfy the deployment's structural invariants. A validation harness SHALL enforce this as the change's acceptance gate.

#### Scenario: Manifests build and validate

- **WHEN** the validation harness runs `kustomize build` piped to `kubeconform -strict`
- **THEN** the build succeeds and validation reports no schema errors

#### Scenario: Structural invariants hold

- **WHEN** the harness inspects the built manifest set
- **THEN** it confirms the api ClusterIP Service, the web Ingress, the worker scrapper sidecar with no scrapper Service, the absence of any Postgres/Redis workload, and that each workload references the `ConfigMap` and `Secret`

### Requirement: Accurate k8s deployment documentation

The `k8s/README.md` SHALL describe the real production topology and SHALL NOT reference an in-cluster PostgreSQL `StatefulSet` or Redis `Deployment`. It SHALL document the per-app workloads, the worker scrapper sidecar, the managed-external Postgres/Redis references, the migration `Job`, the ArgoCD/Image Updater flow, and how secrets are supplied out-of-band.

#### Scenario: README reflects managed-external data stores

- **WHEN** `k8s/README.md` is read
- **THEN** it describes Postgres and Redis as managed external services referenced by `Secret`
- **AND** it does not describe an in-cluster Postgres `StatefulSet` or Redis `Deployment`
