## 0. Acceptance — Manifest validation harness RED

- [x] 0.1 Stand up the validation harness per `design.md` → Test Boundaries: a repo script (e.g. `k8s/validate.sh` or a workspace script) that runs `kustomize build k8s/base` piped to `kubeconform -strict`, plus a small assertion step over the built output. Install `kustomize` + `kubeconform` in the script/CI path (kept out of the app Testcontainers harness).
- [x] 0.2 RED: Write the failing acceptance assertions for the whole change — the built manifest set must contain (a) api `Deployment`+`ClusterIP Service`, (b) web `Deployment`+`Service`+`Ingress`, (c) worker `Deployment` **with a scrapper sidecar container and no scrapper Service**, (d) **no** Postgres/Redis `StatefulSet`/`Deployment`, (e) a migration `Job` carrying the ArgoCD `PreSync` hook, (f) each workload referencing the `ConfigMap` + `Secret`. `SPEC.md` → Infrastructure.
- [x] 0.3 Confirm the harness fails for the right reason (no manifests yet), not a tooling misconfiguration.

## 1. Config & secrets (`kubernetes-deployment`)

- [x] 1.1 RED: Assertion that a `ConfigMap` carries the non-secret keys and a `Secret` carries the sensitive keys, partitioned per `design.md` (sourced from each app's `.env.example`); no sensitive key (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, SMTP creds, `INTERNAL_API_SECRET`, `SENTRY_DSN`) appears in the `ConfigMap`. `SPEC.md` → Configuration.
- [x] 1.2 GREEN: Author `k8s/base/config/configmap.yaml` and `k8s/base/config/secret.example.yaml` (placeholder values only — real secrets supplied out-of-band). Postgres/Redis reachability is via the `DATABASE_URL`/`REDIS_URL` secret entries only.
- [x] 1.3 REFACTOR: De-duplicate shared keys; confirm no real secret material is committed.

## 2. `apps/api` workload (`kubernetes-deployment`)

- [x] 2.1 RED: Assertion that the api `Deployment` + `ClusterIP Service` exist, mount the ConfigMap+Secret, and set liveness/readiness probes to `GET /health`. `SPEC.md` → Infrastructure (Kubernetes), Health Checks.
- [x] 2.2 GREEN: Author `k8s/base/api/deployment.yaml` + `service.yaml` referencing the GHCR api image, the GHCR pull secret, `/health` probes, and `/metrics` port.
- [x] 2.3 REFACTOR: Confirm `kubeconform -strict` passes for the api manifests.

## 3. `apps/web` workload (`kubernetes-deployment`)

- [x] 3.1 RED: Assertion that the web `Deployment` + `Service` + `Ingress` exist (Ingress terminates TLS and sets the public host), with only `NODE_ENV` + `NUXT_PUBLIC_API_BASE_URL` config. `SPEC.md` → Infrastructure, CORS.
- [x] 3.2 GREEN: Author `k8s/base/web/deployment.yaml` + `service.yaml` + `ingress.yaml` referencing the GHCR web image and a readiness HTTP probe.
- [x] 3.3 REFACTOR: Keep the Ingress controller-agnostic where possible; confirm schema validity.

## 4. `apps/worker` workload + scrapper sidecar (`kubernetes-deployment`)

- [x] 4.1 RED: Assertion that the worker `Deployment` has **two containers** (worker + `amerkurev/scrapper`), **no** `Service`/`Ingress`, **no** standalone scrapper `Deployment`, and `SCRAPPER_URL` pointing at `localhost`. `SPEC.md` → Scrapper Sidecar, Infrastructure.
- [x] 4.2 GREEN: Author `k8s/base/worker/deployment.yaml` with the worker container (GHCR worker image, ConfigMap+Secret, `/metrics` port, process/exec liveness — no HTTP server) and the scrapper sidecar container.
- [x] 4.3 REFACTOR: Confirm the sidecar port and worker `SCRAPPER_URL` agree; schema valid.

## 5. Migration Job (`db-migration-job`)

- [x] 5.1 RED: Assertion that a migration `Job` exists, runs `mikro-orm migration:up`, carries `argocd.argoproj.io/hook: PreSync` (+ a hook-delete policy), and uses an image that bundles `packages/db` compiled migrations + MikroORM config. `SPEC.md` → Database Migrations.
- [x] 5.2 GREEN: Resolve the migration image per `design.md` Decisions (dedicated `packages/db` migration image, or extend an app runner stage to include `packages/db` dist + MikroORM CLI/config) and add its build/push to CI; author `k8s/base/migrations/job.yaml` using the `DATABASE_URL` secret and pinned to the app `sha-*` digest. **This is the one task that touches outside `k8s/` (Dockerfile/CI) — keep it minimal and `packages/db`-code-free.**
- [x] 5.3 REFACTOR: Confirm the Job's `PreSync` ordering and failure-blocks-rollout semantics are expressed in the manifest; schema valid.

## 6. GitOps — ArgoCD + Image Updater (`kubernetes-deployment`)

- [ ] 6.1 RED: Assertion that an ArgoCD `Application` tracks `k8s/base` and carries Image Updater annotations referencing the three GHCR images, watching the `latest`/`sha-*` tags. `SPEC.md` → CI/CD, GitOps.
- [ ] 6.2 GREEN: Author `k8s/argocd/application.yaml` with the Image Updater annotations and the chosen write-back strategy; wire the GHCR pull secret reference.
- [ ] 6.3 REFACTOR: Confirm the image refs match `main.yml`'s `ghcr.io/<repo>/{api,web,worker}` output.

## 7. Kustomize assembly

- [ ] 7.1 RED: Assertion that `kustomize build k8s/base` emits the full resource set with no duplicate/undefined references.
- [ ] 7.2 GREEN: Author `k8s/base/kustomization.yaml` tying together config, api, web, worker, and migrations.
- [ ] 7.3 REFACTOR: Optionally add a prod overlay; keep base-only acceptable for the first cut.

## 8. Acceptance — Manifest validation GREEN

- [ ] 8.1 Confirm every spec scenario passes: `kustomize build` + `kubeconform -strict` are clean and all group-0 invariant assertions hold (api ClusterIP; web Ingress; worker sidecar + no scrapper Service; no Postgres/Redis workload; migration Job PreSync; config/secret referenced).
- [ ] 8.2 REFACTOR: Tidy the validation script and (optionally) add it as a CI step so manifests are gated on PRs.

## 9. Docs & polish

- [ ] 9.1 **Replace** the stale `k8s/README.md` (its `base/postgres/` StatefulSet + `base/redis/` Deployment bullets contradict `SPEC.md`) with an accurate operator-facing description: real topology, managed-external Postgres/Redis, the sidecar, the migration Job, ArgoCD/Image Updater, and how secrets are supplied out-of-band. Durable — it's the canonical entry point for anyone deploying Readion.
- [ ] 9.2 Run `yarn lint` / `yarn format` over any added script/TS in the harness and fix issues.
- [ ] 9.3 Confirm the validation harness exits 0 end-to-end on a clean checkout with `kustomize` + `kubeconform` available.
