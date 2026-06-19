## Context

The repository currently holds only specs and docs — no runnable code. This change stands up the Yarn v4 workspace, bootable app/package skeletons, the shared toolchain, the local Docker service stack, and CI, so every later change in `openspec/IMPLEMENTATION-ORDER.md` has a foundation to build and test against. There is no product behavior here; "done" is measured by tooling running green and the apps booting. Constraints are fixed by `SPEC.md` → Tech Stack / Repository Structure (Yarn v4 `node-modules` linker, NestJS+Nuxt, SWC, Vitest+Testcontainers, Biome, Node 24.15).

## Goals / Non-Goals

**Goals:**
- A `yarn install` → `yarn dev` → `yarn lint`/`test`/`build` loop that works on a clean checkout.
- Three apps that boot (api HTTP, worker no-HTTP, web page) and two importable packages.
- A one-command local stack (Postgres+pgvector, Redis, scrapper) and a Testcontainers harness usable without it.
- CI that gates PRs (typecheck/lint/format/test/build) and ships per-app images on `main`.

**Non-Goals:**
- Any domain logic, entities, endpoints, DTOs, or UI features (all later changes).
- Env-var Zod validation / fail-fast (`api-foundation`), global interceptors/filters (`api-foundation`), observability wiring (`observability`), k8s manifests beyond a placeholder dir (`k8s-deployment`).
- A meaningful test suite — only enough smoke/boot tests to prove the toolchain and acceptance scenarios.

## Test Boundaries

The "acceptance test" for this change is the outermost developer/CI workflow: a clean checkout installs, the apps boot, and the gates run. Because this is infrastructure, most collaborators are exercised **real** rather than mocked.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Yarn / workspace resolution | real (`yarn install`, `workspaces list`) | n/a |
| App processes (api/web/worker) | real (boot, hit baseline route) | n/a (boot is an e2e/integration concern) |
| Postgres + pgvector | real (Testcontainers) | real (Testcontainers) |
| Redis | real (Testcontainers) | real (Testcontainers) |
| Scrapper sidecar | real (Docker Compose) for the reachability scenario | n/a (mocked HTTP in later content changes) |
| Docker daemon | real (required for Testcontainers + Compose) | real |
| GitHub Actions runner | real (workflow runs on a PR / `main` push) | n/a — workflow YAML is validated by execution, not unit-tested |
| Container registry push | real (only on `main`) | n/a |

## Decisions

- **Yarn v4 with `nodeLinker: node-modules`** over PnP — NestJS + SWC + many tools assume a real `node_modules`; PnP causes resolution breakage. Recorded as a hard constraint in CLAUDE.md.
- **SWC (`unplugin-swc` + `@swc/core`)** over `tsc` for NestJS build/transform and Vitest — significantly faster builds/tests; `tsc --noEmit` is retained in CI purely for typechecking.
- **Vitest as the single runner** across all workspaces (Jest-compatible, ESM-native) with **Playwright** only for `apps/web` e2e — one mental model, one coverage reporter.
- **Single root `biome.json`** over per-package lint/format configs — one source of truth; matches SPEC.
- **Testcontainers over a shared dev database** for integration tests — isolated, reproducible, no reliance on `docker compose up` being running; the same approach works locally and in CI.
- **One `Dockerfile` per app** under `apps/<name>/` — each image is independently built/tagged for ArgoCD Image Updater; avoids a monolithic image.
- **Placeholder routes/pages for boot proof** — the api baseline route and web placeholder page exist only to make "the app boots" observable; they are replaced by real features later (the real `/health` lands in `api-foundation`).
- **TS path aliases (`@readion/*`) from day one** — enforces the "no relative `../../`" convention and proves cross-workspace imports resolve.

## Risks / Trade-offs

- [Coverage gate on a near-empty scaffold may behave oddly — trivially 100% or failing on files with no tests] → scope the coverage config to source that exists and keep one real smoke test per workspace so the gate is meaningful, not vacuous.
- [Testcontainers requires a Docker daemon in CI] → use a GitHub-hosted runner with Docker available; document the requirement in the workflow.
- [PnP creep — a future `yarn` change could flip the linker] → constraint documented in CLAUDE.md and asserted by the "node_modules exists" acceptance scenario.
- [pgvector image choice — stock `postgres` lacks the extension] → use a pgvector-enabled Postgres image (e.g. `pgvector/pgvector`) in both Compose and Testcontainers so `CREATE EXTENSION vector` succeeds.
- [Nuxt build/runtime in a container can be heavy] → keep the web Dockerfile minimal for now; optimize when `web-*` features land.

## Open Questions

- **Container registry**: GHCR vs Docker Hub vs cloud registry? Affects the `main` workflow's login/push and the image tag format ArgoCD Image Updater watches. (Default assumption: GHCR.)
- **Base images**: `node:24-slim` vs `alpine` per app (alpine + SWC native bindings can be fiddly). (Default assumption: `slim`.)
- **Nuxt rendering mode** for the placeholder: SSR vs SPA/static. Doesn't block scaffolding; revisit in `web-foundation`.
- **Monorepo Docker build context**: per-app context with a pruned install vs root context — affects build caching. Revisit if image build times become a problem.
