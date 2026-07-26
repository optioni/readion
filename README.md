# Readion

A multi-user web application for preparing for certification exams. Study with personalized sessions, AI-generated quizzes, weak area tracking, and an on-demand AI tutor — all driven by up-to-date content from official docs, YouTube, Reddit, whitepapers, and more.

**Supported certifications:** AWS, Azure, Kubernetes (CKA/CKAD/CKS), AI/ML (TensorFlow, Databricks, Google Cloud ML, Hugging Face)

## Prerequisites

- Node.js 24.18 (`nvm use`)
- Yarn v4 (`corepack enable`)
- Docker + Docker Compose

## Quick Start

```bash
# Install dependencies
yarn install

# Start local services (Postgres + pgvector, Redis, scrapper)
docker compose up -d

# Copy and fill in environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env

# Run database migrations
yarn workspace @readion/db migration:up

# Start all apps
yarn dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- API docs (dev only): http://localhost:3001/api-json

## Architecture

A Yarn v4 monorepo with three apps:

| App | Description |
|---|---|
| `apps/api` | NestJS REST API — auth, sessions, quizzes, AI agent |
| `apps/web` | NuxtJS frontend — dashboard, session view, progress, admin |
| `apps/worker` | NestJS content pipeline — ingests and embeds learning material |

Shared packages: `packages/db` (MikroORM entities + migrations), `packages/shared` (types, DTOs, constants).

See `DESIGN.md` for architecture decisions and data flow diagrams, and `SPEC.md` for the full feature specification.

## Tech Stack

- **Backend:** NestJS, MikroORM, PostgreSQL + pgvector, Redis, BullMQ
- **Frontend:** NuxtJS (Vue 3), Nuxt UI, TailwindCSS, Pinia, TanStack Query
- **AI:** Vercel AI SDK (provider-agnostic), OpenAI embeddings
- **Tooling:** Biome, Vitest, Playwright, Testcontainers, SWC
- **Ops:** Kubernetes, ArgoCD, GitHub Actions, Pino, Sentry, Prometheus, OpenTelemetry

## Development

See `AGENTS.md` for detailed development instructions, testing patterns, code conventions, and common gotchas.

```bash
yarn test           # Unit and integration tests
yarn test:coverage  # Coverage report (≥ 80% required)
yarn lint           # Lint check
yarn format         # Format check
yarn build          # Build all apps
```
