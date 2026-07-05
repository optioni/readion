## Reviewed Artifacts

- proposal.md
- specs/kubernetes-deployment/spec.md
- specs/db-migration-job/spec.md
- design.md
- tasks.md

Cross-checked against `SPEC.md` → Infrastructure (Kubernetes production table, Scrapper Sidecar, Database Migrations, CI/CD), Observability → Health Checks, and each app's `.env.example` (`apps/{api,web,worker}/.env.example`).

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | proposal.md → Scope / Impact | Proposal stated scope is "infra-as-config only … no application code" and that the three Dockerfiles and `main.yml` image build/push are "consumed unchanged". This directly contradicts `design.md` → Decisions ("Migration Job image bundles `packages/db`"), Risks ("Migration Job image doesn't exist yet"), and `tasks.md` task 5.2, which require a Dockerfile/CI touch to build+push a migration image (the current api/worker runner stages omit the compiled `packages/db` migrations). | Reconciled the proposal's scope and impact language to acknowledge the one deliberate reach beyond `k8s/`: a minimal Dockerfile/CI addition for a migration image bundling the already-compiled `packages/db` migrations + MikroORM config, with **no `packages/db` source change**. Cross-referenced design and task 5.2. | proposal.md → "Why" scope paragraph and "Impact" (Consumes) bullet |

## No Remaining Implementation-Blocking Gaps

All implementation-blocking planning gaps are resolved. Verification of each checklist dimension:

- **Capability coverage** — proposal names exactly two capabilities (`kubernetes-deployment`, `db-migration-job`); both have a `specs/**/spec.md` file, and every requirement in each is in the `ADDED` section (this is a net-new deployment layer, so no MODIFIED/REMOVED/RENAMED). No capability lives only in tasks.md/design.md.
- **Scenario coverage** — every spec scenario maps to acceptance/assertion work in tasks.md: per-app workloads → groups 2/3/4; scrapper sidecar + no scrapper Service → group 4 and assertion 0.2(c); managed-external Postgres/Redis (no StatefulSet/Deployment) → task 1.2 and assertion 0.2(d); ConfigMap/Secret partition → group 1; health probes (api `/health`, worker no HTTP probe) → tasks 2.1/4.1/4.2; GitOps ArgoCD + Image Updater → group 6; schema-valid + structural invariants → groups 0/7/8; README topology → task 9.1; migration `Job` running `mikro-orm migration:up` with the `PreSync` hook and digest pinning → group 5.
- **Design completeness** — design.md resolves the implementation-critical choices before coding: managed-external data stores referenced by `Secret` only; scrapper as a worker-pod sidecar reached over `localhost`; the migration `Job` as an ArgoCD `PreSync` hook with a hook-delete policy and digest pinning; the config-vs-secret partition keyed off `.env.example`; probe strategy per workload; the manifest layout; and the ArgoCD/Image Updater write-back concern. The migration-image gap (compiled `packages/db` not present in current runner stages) is explicitly flagged as the one cross-artifact risk.
- **Test boundaries** — design.md → Test Boundaries names each real-vs-out-of-scope collaborator for the acceptance gate (`kustomize build` + `kubeconform -strict` and assertions over the built output are "real"; live cluster, ArgoCD, Image Updater, managed Postgres/Redis, and actual `Job` execution are explicitly **not** in the gate). No task invents a boundary the design does not name; tasks.md keeps this out of the Testcontainers harness as design requires.
- **Task alignment** — tasks.md follows outside-in order (acceptance harness RED in group 0, per-resource RED→GREEN→REFACTOR, acceptance GREEN in group 8) and covers every requirement, the migration-image Dockerfile/CI touch (5.2), the durable `k8s/README.md` rewrite (9.1), and lint/format + end-to-end harness verification (9.2/9.3). No generated-client or visual-design reconciliation applies (no API surface or UI change).
- **Contradictions and stale assumptions** — after the proposal fix above, proposal/specs/design/tasks agree on scope, resource topology, the managed-external decision, env-var partition, probe strategy, and verification expectations. The env-var partition was spot-checked against the real `.env.example` files: `INTERNAL_API_SECRET`/`SENTRY_DSN`/`DATABASE_URL`/`REDIS_URL` land in the Secret and `INTERNAL_API_BASE_URL`/`SCRAPPER_URL`/`LOG_LEVEL`/`PROMETHEUS_PORT`/tuning knobs in the ConfigMap; web needs only `NODE_ENV` + `NUXT_PUBLIC_API_BASE_URL` — all consistent with design.md's partition. The `SPEC.md` CI/CD "tag with the branch name" wording vs the implemented `latest`/`sha-*` tagging is already explicitly reconciled in design.md → Risks (no `main.yml` tag-strategy change required).

## Deferred Non-Blocking Notes

- **`db-migration-job` runtime scenarios are structurally, not behaviorally, gated.** The "migrations complete before app rollout" and "failed migration halts the sync" scenarios describe live ArgoCD `PreSync` behavior, which design.md → Test Boundaries places outside the manifest-validation gate. The acceptance harness verifies these structurally (the `Job` carries `argocd.argoproj.io/hook: PreSync` + a hook-delete policy per tasks 5.1/5.3); the actual halt-on-failure behavior is validated operationally at deploy time. This is an intentional, design-acknowledged boundary, not a missing test.
- **Open questions in design.md are non-blocking by construction.** The migration-image shape (dedicated image vs extended runner stage), kustomize base-vs-overlay split, the secret-management backend, and the Ingress controller/TLS issuer are all environment/operational choices; design.md states base-only and a controller-agnostic Ingress are acceptable for the first cut, and tasks.md carries the decision points (5.2, 3.3, 7.3) without blocking implementation start.
