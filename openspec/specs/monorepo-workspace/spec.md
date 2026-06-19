## Purpose

Yarn v4 workspace topology, Node version pinning, root scripts, TypeScript base configuration, Biome linting/formatting, and Vitest coverage setup that define the monorepo's developer experience and build system.

## Requirements

### Requirement: Yarn v4 workspace topology

The repository SHALL be a Yarn v4 workspace whose members are exactly `apps/api`, `apps/web`, `apps/worker`, `packages/shared`, and `packages/db`, using `nodeLinker: node-modules`, pinned to Node 24.15 via `.nvmrc`.

#### Scenario: Install resolves all workspaces

- **WHEN** a developer runs `yarn install` on a clean checkout
- **THEN** the command exits `0`
- **THEN** `yarn workspaces list --json` emits exactly five entries with locations `apps/api`, `apps/web`, `apps/worker`, `packages/shared`, `packages/db`
- **THEN** a `node_modules` directory exists at the repo root (proving `nodeLinker: node-modules`, not PnP)

#### Scenario: Node version is pinned

- **WHEN** the `.nvmrc` file is read
- **THEN** it contains `24.15`

### Requirement: Root scripts fan out across workspaces

The root `package.json` SHALL expose `dev`, `lint`, `format`, `test`, `test:coverage`, and `build` scripts that operate across every workspace.

#### Scenario: Lint runs clean on the scaffold

- **WHEN** a developer runs `yarn lint`
- **THEN** Biome checks every workspace and the command exits `0`

#### Scenario: Build compiles every workspace

- **WHEN** a developer runs `yarn build`
- **THEN** each app and package compiles with no TypeScript errors and the command exits `0`

#### Scenario: Test command runs across workspaces

- **WHEN** a developer runs `yarn test`
- **THEN** Vitest executes each workspace's suite and the command exits `0`

### Requirement: Apps boot from the scaffold

Each application skeleton SHALL start under `yarn dev`: `apps/api` as a NestJS HTTP server, `apps/worker` as a NestJS application with no HTTP listener, and `apps/web` as a NuxtJS server.

#### Scenario: API serves a baseline route

- **WHEN** `apps/api` is started in development
- **THEN** an HTTP `GET /` (or the scaffolded baseline route) returns a `2xx` response

#### Scenario: Web serves a placeholder page

- **WHEN** `apps/web` is started in development
- **THEN** an HTTP `GET /` returns `200` with an HTML document

#### Scenario: Worker boots without binding a port

- **WHEN** `apps/worker` is started in development
- **THEN** the process reaches a ready state and logs startup
- **THEN** it does not open an HTTP listener

### Requirement: Packages are importable via path aliases

`packages/shared` and `packages/db` SHALL be buildable workspace packages consumable from the apps through TypeScript path aliases rather than relative `../../` paths.

#### Scenario: An app imports a package by alias

- **WHEN** `apps/api` imports an exported symbol from `@readion/shared` using its path alias
- **THEN** `yarn workspace apps/api build` resolves the import and exits `0`

### Requirement: TypeScript strict mode and shared base config

A root TypeScript base config SHALL enable `strict` mode and define the workspace path aliases; every workspace extends it. NestJS apps SHALL compile/transform via SWC.

#### Scenario: Strict mode is active

- **WHEN** the resolved compiler options for any workspace are inspected
- **THEN** `strict` is `true`

### Requirement: Coverage threshold is enforced

The Vitest coverage configuration SHALL require at least 80% line and branch coverage.

#### Scenario: Coverage gate fails below threshold

- **WHEN** `yarn test:coverage` runs against a suite whose line or branch coverage is below 80%
- **THEN** the command exits non-zero
