## Why

Every feature in the SPEC — auth, the content pipeline, sessions, the agent — assumes a working monorepo with a shared toolchain, runnable local services, and CI that enforces the project's quality bar. None of that exists yet: the repo holds only specs and docs. This change lays the foundation the rest of the roadmap builds on, and nothing else can be implemented (or tested outside-in) until it does.

The scope is deliberately narrow: stand up the workspace, the empty-but-bootable app/package skeletons, the shared tooling, the local dev stack, and CI. **No domain logic, entities, endpoints, or UI features** — those land in later, dependent changes.

## What Changes

- **Yarn v4 workspace root** — `package.json` (workspaces), `.yarnrc.yml` with `nodeLinker: node-modules`, `.nvmrc` (Node 24.15), and root scripts (`dev`, `lint`, `format`, `test`, `test:coverage`, `build`) that fan out across workspaces.
- **App skeletons** — `apps/api` and `apps/worker` as minimal NestJS apps (api serves a trivial route; worker boots with no HTTP server), and `apps/web` as a minimal NuxtJS app serving a placeholder page. Each boots cleanly under `yarn dev`.
- **Package skeletons** — `packages/shared` and `packages/db` as buildable, importable workspace packages (via TS path aliases) with no real contents yet.
- **Shared tooling** — single root `biome.json` (lint + format), per-app `vitest.config.ts` wired to the shared base, SWC (`@swc/core` + `unplugin-swc`) for NestJS compilation/transform, root `tsconfig` base with strict mode and path aliases, and the **80% line/branch coverage** threshold.
- **Local dev environment** — `docker-compose.yml` with `postgres` (pgvector), `redis`, and `scrapper` services, plus a `.env.example` at each app root documenting its required variables.
- **Containerization** — a `Dockerfile` per app (`apps/api`, `apps/web`, `apps/worker`).
- **CI/CD** — GitHub Actions: a PR workflow (typecheck, `biome check`, `vitest run` with Testcontainers, build) and a push-to-`main` workflow that builds and tags a Docker image per app for ArgoCD Image Updater.
- **K8s base directory** — `k8s/` seeded with placeholder base manifests (filled in per-app by later changes).

## Capabilities

### New Capabilities
- `monorepo-workspace`: Yarn v4 workspace topology, the bootable app/package skeletons, and the shared toolchain (Biome, Vitest+coverage, SWC, TypeScript base, root scripts) that every later change consumes.
- `local-dev-environment`: the Docker Compose service stack (Postgres+pgvector, Redis, scrapper) and the per-app `.env.example` contracts that let a developer run and test the stack locally and in Testcontainers.
- `ci-pipeline`: GitHub Actions PR checks (typecheck, lint, format, test, build) and the main-branch image build/tag pipeline that gates and ships every subsequent change.

### Modified Capabilities
<!-- None — this is the first change; there are no existing specs to modify. -->

## Impact

- **Creates** the entire top-level repo structure: `apps/{api,web,worker}`, `packages/{shared,db}`, `k8s/`, `.github/workflows/`, `docker-compose.yml`, root config files.
- **Dependencies introduced** (skeleton-level only): NestJS, NuxtJS, MikroORM (package present, no entities), Biome, Vitest, Playwright, Testcontainers, SWC, Yarn v4.
- **Blocks**: every other change in the roadmap depends on this one. See `openspec/IMPLEMENTATION-ORDER.md`.
- **No runtime behavior** for end users — there are no features yet; success is measured by tooling and boot, not product behavior.
