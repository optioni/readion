## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Stand up the verification harness per design.md Test Boundaries: Playwright for `apps/web` e2e, a root Vitest smoke project, and a Testcontainers base helper (Postgres+pgvector, Redis). No external services are mocked — all are real.
- [x] 0.2 RED: Write the failing acceptance checks for the whole loop — (a) Playwright e2e "web serves a placeholder page" (`GET /` → 200 HTML); (b) a workspace smoke test asserting `yarn workspaces list --json` emits exactly the five members and a root `node_modules` exists.
- [x] 0.3 Confirm both fail for the right reason (no workspace / no apps yet), not a harness misconfiguration.

## 1. Workspace root & shared toolchain

- [x] 1.1 RED: Smoke test asserting the five workspace members resolve, `nodeLinker` is `node-modules` (root `node_modules` present), `.nvmrc` is `24.15`, and resolved TS `strict` is `true`.
- [x] 1.2 GREEN: Create root `package.json` (workspaces + `dev`/`lint`/`format`/`test`/`test:coverage`/`typecheck`/`build` scripts), `.yarnrc.yml` (`nodeLinker: node-modules`), `.nvmrc`, root `tsconfig.base.json` (strict + `@readion/*` path aliases), `biome.json`, and the shared Vitest base config with the ≥80% line/branch coverage gate.
- [x] 1.3 REFACTOR: De-duplicate config, confirm root scripts fan out across all workspaces.

## 2. Shared packages (`packages/shared`, `packages/db`)

- [x] 2.1 RED: Unit test importing an exported symbol from `@readion/shared` via its path alias and asserting `yarn workspace apps/api build` resolves it.
- [x] 2.2 GREEN: Scaffold `packages/shared` and `packages/db` (each: `package.json`, `tsconfig` extending the base, an `index.ts` export). `packages/db` includes a MikroORM config stub with no entities yet.
- [x] 2.3 REFACTOR: Confirm both packages build standalone and are consumable by alias.

## 3. `apps/api` skeleton

- [x] 3.1 RED: Integration test (`@nestjs/testing` + Supertest) booting the Nest app and asserting the baseline route returns `2xx`.
- [x] 3.2 GREEN: Minimal NestJS app (SWC via `unplugin-swc`, app module, baseline controller), per-app `vitest.config.ts`, `Dockerfile`, and `.env.example`.
- [x] 3.3 REFACTOR: Trim boilerplate; confirm `yarn workspace apps/api dev` boots.

## 4. `apps/worker` skeleton

- [x] 4.1 RED: Test booting the worker application context, asserting it reaches a ready state and opens no HTTP listener.
- [x] 4.2 GREEN: Minimal NestJS standalone application (no HTTP server) with SWC, `Dockerfile`, and `.env.example`.
- [x] 4.3 REFACTOR: Confirm `yarn workspace apps/worker dev` boots clean.

## 5. `apps/web` skeleton

- [x] 5.1 RED: Component/route test asserting the placeholder page renders (feeds the group-0 Playwright e2e).
- [x] 5.2 GREEN: Minimal NuxtJS app (Nuxt UI + TailwindCSS, dark mode, placeholder page), per-app Vitest config, `Dockerfile`, and `.env.example`.
- [x] 5.3 REFACTOR: Confirm `yarn workspace apps/web dev` serves `GET /` → 200 HTML.

## 6. Local dev service stack

- [x] 6.1 RED: Testcontainers integration test starting a pgvector Postgres + Redis, asserting `CREATE EXTENSION IF NOT EXISTS vector;` succeeds and Redis `PING` → `PONG`.
- [x] 6.2 GREEN: Write root `docker-compose.yml` with `postgres` (pgvector image), `redis`, and `scrapper` services; wire the Testcontainers helper from task 0.1 to use the same images.
- [x] 6.3 REFACTOR: Parameterize image tags/ports; document the scrapper-reachability expectation.

## 7. CI pipeline

- [x] 7.1 RED: Add the PR workflow expecting the full gate (typecheck, `biome check`, `vitest run` with Testcontainers, build of all apps); verify it is exercised on this change's own PR and would fail on a lint/coverage violation.
- [x] 7.2 GREEN: Author `.github/workflows/pr.yml` (the gate, Docker available for Testcontainers) and `.github/workflows/main.yml` (build + push one image per app from its `Dockerfile`, tagged for ArgoCD Image Updater).
- [x] 7.3 REFACTOR: Add workspace/app matrix and dependency caching; confirm a failing app build blocks the publish.

## 8. Kubernetes base placeholder

- [x] 8.1 Create the `k8s/` directory with placeholder base manifests (a README marker), to be filled in by the later `k8s-deployment` change.

## 9. Acceptance Test — Outer Loop GREEN

- [x] 9.1 Confirm every spec scenario passes end-to-end: install resolves five workspaces; api/web/worker boot; `yarn lint`/`build`/`test` exit 0; `docker compose up -d` brings services healthy; Testcontainers provisions Postgres+Redis; the coverage gate fails below 80%.
- [x] 9.2 REFACTOR: Clean up the shared test harness and Testcontainers helpers.

## 10. Polish

- [x] 10.1 Run linter and fix all errors (`yarn lint`)
- [x] 10.2 Run formatter and apply fixes (`yarn format`)
- [x] 10.3 Run type checker with zero errors (`yarn typecheck`)
- [x] 10.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
- [x] 10.5 Update `README.md` (Setup / Development commands section, audience: new contributors & operators) to reflect the now-real `yarn install` → `docker compose up` → `yarn dev` flow and the per-app `.env.example` step — durable because it is the canonical entry point for anyone bootstrapping the repo.
