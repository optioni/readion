# AGENTS.md

## Project Overview

A multi-user web application for preparing for certification exams (AWS, Azure, Kubernetes, AI/ML). The tool ingests learning material from multiple external sources, generates personalized study sessions and quizzes via LLM, tracks performance over time, and exposes a streaming AI tutor agent.

Product requirements (why/who/success): `PRD.md`. Full specification (incl. architecture decisions): `SPEC.md`. UI design system: `DESIGN.md`.

## Monorepo Structure

```
learning-tool/
├── apps/
│   ├── api/        # NestJS API server
│   ├── web/        # NuxtJS (Vue 3) frontend
│   └── worker/     # NestJS content pipeline worker (no HTTP server)
├── packages/
│   ├── shared/     # TypeScript types, DTOs, Zod schemas, constants
│   └── db/         # MikroORM entities and migrations
├── k8s/            # Kubernetes base manifests
├── .github/workflows/
├── docker-compose.yml
├── biome.json      # Single lint/format config for all apps and packages
└── package.json    # Yarn v4 workspace root
```

## Prerequisites

- Node.js 24.15 (use `.nvmrc` — `nvm use`)
- Yarn v4 (`corepack enable`)
- Docker + Docker Compose (for local dev services)

## Setup

```bash
# Install dependencies
yarn install

# Start local services (Postgres with pgvector, Redis, scrapper)
docker compose up -d

# Run database migrations
yarn workspace @learning-tool/db migration:up

# Start all apps in development mode
yarn dev
```

Individual apps:

```bash
yarn workspace apps/api dev
yarn workspace apps/web dev
yarn workspace apps/worker dev
```

## Environment Variables

Each app has a `.env.example` at its root. Copy and fill in before running:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env
```

All env vars are validated with Zod at startup — the app will fail fast with a clear error if anything is missing or malformed.

## Testing

This project uses **outside-in TDD**. Always write tests in this order:

1. Failing Playwright e2e test (defines the goal)
2. Failing NestJS integration test (Supertest + `@nestjs/testing` + Testcontainers)
3. Failing unit test (pure logic)
4. Implementation to make tests pass

**Run tests:**

```bash
# All unit and integration tests
yarn test

# Specific workspace
yarn workspace apps/api test
yarn workspace apps/web test
yarn workspace apps/worker test

# Watch mode
yarn workspace apps/api test:watch

# Coverage (must be ≥ 80%)
yarn test:coverage

# E2E (requires running app)
yarn workspace apps/web test:e2e
```

**Rules:**
- Integration tests hit real Postgres and Redis via Testcontainers — never mock the database
- Unit tests are for pure logic only (scoring, calculation, chunking, etc.)
- Co-locate tests with source files as `*.spec.ts`
- E2E tests live in `apps/web/e2e/`
- Minimum 80% line and branch coverage — CI enforces this

## Code Style

Biome handles all linting and formatting. A single `biome.json` at the workspace root applies to all apps and packages.

```bash
# Check
yarn lint

# Fix
yarn lint:fix

# Format check
yarn format

# Format fix
yarn format:fix
```

**Conventions:**
- TypeScript strict mode throughout — no `any`, no `as unknown`
- No comments unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround for a specific bug)
- Never explain WHAT the code does — well-named identifiers do that
- NestJS: one module per domain concept, feature-based file structure
- Imports: absolute paths using TypeScript path aliases, not relative `../../`
- No backwards-compatibility hacks — if something is unused, delete it

## API Patterns

- REST, versioned under `/api/v1`
- Response envelope: `{ data, relationships }` for single resources, `{ data[], meta }` for collections
- `?include=relName` to expand related resources inline — a single response schema per resource with each relationship's `data` field optional/nullable (presence depends on the `include` param), not a distinct schema per include combination
- Errors: RFC 7807 Problem Details (`{ type, title, status, detail, errors[] }`)
- Actions: `POST /api/v1/:resource/:id/:action` (e.g. `POST /api/v1/sessions/:id/end`)
- Global `ResponseInterceptor` wraps all success responses — do not manually wrap in controllers
- Global `ExceptionFilter` formats all errors — throw NestJS `HttpException` subclasses, not plain objects

## Generating the API Client

When you change the NestJS API, regenerate the Orval client and commit the output:

```bash
# Requires apps/api to be running (yarn workspace apps/api dev)
yarn codegen
```

The generated client lives in `apps/web/src/api/` and is committed to the repository. CI does not regenerate it.

## Database

MikroORM manages entities, migrations, and queries. The `packages/db` package owns all of this and is shared by `apps/api` and `apps/worker`.

```bash
# Create a new migration
yarn workspace @learning-tool/db migration:create

# Run migrations
yarn workspace @learning-tool/db migration:up

# Rollback
yarn workspace @learning-tool/db migration:down
```

Never modify migration files after they have been committed — create a new migration instead.

## Key Domain Concepts

- **UserCertification** — a user's enrollment in a cert. Readiness score, weak areas, and session history are all scoped to this join entity, not to `Certification` directly.
- **Two content layers** — `ContentChunk` (shared ingested knowledge base) vs. LLM-generated content (personalized per user). Personalization happens at generation time, not ingestion time.
- **StudySession** — items are pre-generated before the session starts. Reading blocks are LLM-formatted Markdown. Sessions resume via `lastItemIndex`.
- **AgentConversation** — all message types (user/assistant/tool/system) are persisted as JSONB rows mirroring the Vercel AI SDK `CoreMessage` type. Pass the full ordered array to the SDK to resume.
- **WeakArea** — aggregated per user, per certification, per domain. Updated after every session and mock exam.

## LLM Calls

All LLM calls go through the Vercel AI SDK. Never import provider SDKs directly.

```typescript
// Good
import { generateText } from 'ai'

// Bad
import Anthropic from '@anthropic-ai/sdk'
```

Model IDs come from config, never hardcoded. Use the right model tier for the task:
- **Utility model** — quiz generation, domain tagging (fast, cheap)
- **Mid-tier model** — agent responses, material generation
- **Thinking model** — complex reasoning tasks only

## PR Guidelines

- Title format: `feat(scope): description` / `fix(scope): description` / `chore(scope): description`
- Every PR must pass: typecheck, lint, format, tests (≥ 80% coverage), build
- Run `yarn codegen` and commit generated client if you changed the API
- No force-pushes to `main`

## Common Gotchas

- `nodeLinker: node-modules` is required in `.yarnrc.yml` for NestJS compatibility — do not change this to PnP
- The scrapper sidecar must be running (`docker compose up scrapper`) for content ingestion tests
- pgvector dimension must match the embedding model — default is 1536 (OpenAI `text-embedding-3-small`). Changing the model requires a migration.
- `@nestjs/swagger` is disabled in production — only `/api-json` is available in development for Orval
- Standalone agent conversations have a sliding 4-hour inactivity TTL (session-linked ones follow their `StudySession` lifecycle) — do not store long-lived state in them
