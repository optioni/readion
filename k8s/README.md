# Kubernetes Deployment

Operator-facing entry point for deploying Readion to a Kubernetes cluster.
This is the canonical description of the real topology — if you're looking
for how to get Readion running in a cluster, start here.

## Topology

Readion runs as three application workloads plus one one-shot migration
Job. Postgres and Redis are **managed, external services** — there is no
in-cluster Postgres `StatefulSet` or Redis `Deployment`, and no such
workload should ever be added to `k8s/base`. (An early planning draft of
this README proposed one; that plan was dropped in favor of managed
services and is gone.)

| Workload | Kind | Service | Ingress | Notes |
|---|---|---|---|---|
| `apps/api` | Deployment | ClusterIP `Service` (port 80 → `http`/3001) | — | Probes `GET /health` on 3001; metrics scraped from `GET /metrics` on 3001 (`prometheus.io/*` pod annotations). |
| `apps/web` | Deployment | ClusterIP `Service` (port 3000) | `Ingress` (TLS) | Public entry point. Only non-secret env (`NODE_ENV`, `NUXT_PUBLIC_API_BASE_URL`) — sourced per-key from the ConfigMap, no Secret reference. |
| `apps/worker` | Deployment | — | — | Runs the `amerkurev/scrapper` **sidecar** in the same pod — not a separate Deployment/Service. The worker reaches it at `http://localhost:3000` (`SCRAPPER_URL`). No HTTP server of its own, so liveness is an `exec` process check; metrics are exposed on 9091. |
| `db-migrate` | Job | — | — | ArgoCD `PreSync` hook. Runs `mikro-orm migration:up` before api/worker roll out. See [Migration Job](#migration-job) below. |

Postgres and Redis connection details reach every workload only through the
`readion-secret` Secret (see [Config vs Secret](#config-vs-secret) below) —
there is nothing to deploy for them in this repo.

## Connection env vars — read this before deploying

The app and the migration CLI connect to Postgres via **discrete**
`DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` keys, which is
what `packages/db`'s MikroORM config reads — there is no `DATABASE_URL`.

The `apps/api` and `apps/worker` env schemas require all five `DB_*` keys to
be explicitly set whenever `NODE_ENV=production`, and fail fast at boot
naming whichever are missing. This closes a prior gap where a deploy could
carry only placeholder `DB_*` values and the app/`db-migrate` Job would
silently fall back to the MikroORM localhost dev defaults instead of
refusing to start.

**When provisioning the real Secret, set real values for** all five `DB_*`
keys plus `REDIS_URL`. The committed `k8s/base/config/secret.example.yaml`
holds only placeholders (`"replace-me"`) — never fill it in and commit it as-is.

## Config vs Secret

- **Non-sensitive** config → `readion-config` ConfigMap
  (`k8s/base/config/configmap.yaml`): ports, feature thresholds, public
  URLs, log level, etc.
- **Sensitive** config → `readion-secret` Secret
  (`k8s/base/config/secret.example.yaml` is the committed template only):
  `DB_*`, `REDIS_URL`, `JWT_SECRET`, SMTP credentials,
  `INTERNAL_API_SECRET`, `SENTRY_DSN`.

The real Secret is **never committed**. Supply it out-of-band via
sealed-secrets, external-secrets, or your cloud provider's secret store,
applied to the `readion` namespace with the name `readion-secret` so it
matches what every Deployment/Job references. The same applies to the
GHCR image pull secret, `ghcr-pull-secret` — also supplied out-of-band,
referenced by every workload's `imagePullSecrets`.

## Migration Job

`k8s/base/migrations/job.yaml` (`db-migrate`) runs
`mikro-orm migration:up` as an ArgoCD `PreSync` hook
(`argocd.argoproj.io/hook: PreSync`), with a
`BeforeHookCreation` hook-delete policy so a leftover Job from a prior sync
never blocks the next one. Because it's a PreSync hook, it completes
**before** the api/worker Deployments are synced to the new revision — a
failed migration fails the sync at pre-sync and blocks the rollout, leaving
the previously-running version in place.

It **reuses the `api` image** (`ghcr.io/<repo>/api`): the api runner stage
already ships `node_modules` (including the `mikro-orm` CLI) and
`packages/db/dist` (compiled migrations + MikroORM config), so no dedicated
migration image is needed. Because the Job and the api Deployment reference
the same image, the ArgoCD Image Updater's single `api` alias pins both to
the same digest — schema and application code from the same commit move
together by construction.

## GitOps

`k8s/argocd/application.yaml` defines the ArgoCD `Application` that tracks
`k8s/base` (`spec.source.path`) on `targetRevision: main`. It is not part
of the `k8s/base` kustomization — `kubeconform` has no bundled schema for
the `argoproj.io/v1alpha1` Application CRD, so it's validated separately
(see [Validating](#validating) below).

Image Updater annotations watch `ghcr.io/<repo>/{api,web,worker}`
on the `latest`/`sha-*` tags (`allow-tags`, `update-strategy: digest`). A
new digest triggers a rollout. The write-back method is **git**: the
resolved digest is committed back to this repo, so `k8s/base` (and
`git log`/`git blame` on it) stays the single source of truth for what's
actually running, rather than relying on ArgoCD's live-manifest cache.

## Manifest layout

```
k8s/
├── README.md                     # this file
├── validate.sh                   # validation harness — see below
├── base/
│   ├── kustomization.yaml         # assembles all 9 resources below
│   ├── config/
│   │   ├── configmap.yaml         # readion-config (non-sensitive)
│   │   └── secret.example.yaml    # readion-secret TEMPLATE — placeholders only
│   ├── api/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── web/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── ingress.yaml
│   ├── worker/
│   │   └── deployment.yaml        # worker container + scrapper sidecar
│   └── migrations/
│       └── job.yaml               # db-migrate, ArgoCD PreSync hook
└── argocd/
    └── application.yaml           # ArgoCD Application + Image Updater config
```

All resources live in the `readion` namespace, set once via
`k8s/base/kustomization.yaml`'s `namespace: readion` (this must match
`k8s/argocd/application.yaml`'s `spec.destination.namespace` so a local
`kustomize build k8s/base` reproduces exactly what ArgoCD applies).

## Validating

```bash
bash k8s/validate.sh
```

This builds `k8s/base` with `kustomize` (or `kubectl kustomize` as a
fallback), schema-validates the output with `kubeconform -strict`, and then
asserts the structural invariants described above (topology, config/secret
split, migration Job hook wiring, exact 9-resource assembly, ArgoCD
Application shape) using `yq`. Run `k8s/validate.sh --help` for exit code
details and tooling install instructions.

Required tooling: `kustomize` or `kubectl`, `kubeconform`, `yq`.

This same script is gated in CI by the `manifests` job in
`.github/workflows/pr.yml`, which installs the same tooling on the runner
and runs it on every pull request — it is not folded into `yarn test` or
`yarn lint`.

## Prerequisites (provisioned out-of-band)

Before deploying, the target cluster/environment needs, none of which this
repo provisions:

- A managed Postgres instance with the `pgvector` extension enabled.
- A managed Redis instance.
- The `ghcr-pull-secret` image pull secret in the `readion` namespace.
- An Ingress controller and a TLS certificate issuer (e.g. cert-manager)
  serving the `web` Ingress's host/TLS block.
- An ArgoCD installation with the Image Updater component, configured with
  write access to this repo (required by the `git` write-back method).
