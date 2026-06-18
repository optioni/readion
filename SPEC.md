# Learning Tool — Specification

## Overview

A multi-user web application for preparing for certification exams (e.g. AWS Cloud Practitioner). The tool ingests learning material from multiple sources, generates personalized study sessions and quizzes, tracks user performance over time, and exposes a streaming AI agent for on-demand tutoring — all configured to match the learner's available time, learning style, and exam readiness.

---

## Goals

- Help users pass certification exams through structured, adaptive study sessions
- Source and keep learning material up to date from a wide variety of public sources
- Adapt session content and difficulty based on demonstrated weak areas and confidence
- Provide an AI tutor agent available both within sessions and standalone
- Support multiple simultaneous users with independent progress tracking

## Non-Goals (v1)

- Mobile native apps (web only)
- Social/community features (leaderboards, peer study groups)
- Paid content integrations (Udemy, A Cloud Guru, etc.)
- Exam booking or scheduling integrations
- Offline mode
- Internationalisation — English only in v1

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Yarn v4 workspaces |
| Backend API | NestJS (Node.js) |
| Frontend | NuxtJS (Vue 3) |
| Background worker | NestJS (no HTTP server) |
| ORM | MikroORM with `@mikro-orm/nestjs` |
| Primary database | PostgreSQL with pgvector extension |
| Queue / cache | Redis (BullMQ + session cache) |
| AI SDK | Vercel AI SDK (provider-agnostic) |
| Web scraping | amerkurev/scrapper (Docker sidecar) |
| API client generation | Orval (generates typed Vue Query composables from OpenAPI spec) |
| Data fetching | `@tanstack/vue-query` (configured as a Nuxt plugin, consumed via Orval-generated composables) |
| Component library | Nuxt UI |
| Styling | TailwindCSS |
| State management | Pinia |
| Linting & formatting | Biome (single config at workspace root) |
| Testing | Vitest + Playwright + Testcontainers |
| NestJS compiler | SWC (`@swc/core` + `unplugin-swc`) |
| Runtime | Node.js 24.15 |
| Error reporting | Sentry (`@sentry/nestjs`, `@sentry/nuxt`) |
| Logging | Pino (`nestjs-pino`) |
| Metrics | Prometheus (`@willsoto/nestjs-prometheus`) |
| Tracing | OpenTelemetry (`@opentelemetry/sdk-node`) |
| Health checks | `@nestjs/terminus` |
| Config validation | `@nestjs/config` + Zod |
| GitOps | ArgoCD + ArgoCD Image Updater |
| Deployment | Kubernetes |

---

## Repository Structure

```
learning-tool/
├── apps/
│   ├── api/          # NestJS API server
│   ├── web/          # NuxtJS frontend
│   └── worker/       # NestJS content pipeline worker
├── packages/
│   ├── shared/       # TypeScript types, DTOs, constants
│   └── db/           # MikroORM entities, migrations (shared by api + worker)
├── k8s/              # Kubernetes base manifests
├── docker-compose.yml
├── package.json      # Yarn v4 workspace root
├── .yarnrc.yml
└── SPEC.md
```

Yarn v4 with `nodeLinker: node-modules` for NestJS compatibility. Each app has its own `Dockerfile` and `package.json`.

---

## Data Layer

### PostgreSQL + pgvector

All persistent data lives in PostgreSQL. The pgvector extension enables semantic similarity search over content embeddings without a separate vector database.

### MikroORM

The `packages/db` package owns all MikroORM entities, migrations, and typed repository helpers. Both `apps/api` and `apps/worker` import from this package. Connection pooling uses MikroORM's default configuration.

### pgvector Index

The `content_chunks` embedding column uses an **HNSW index** (`vector_cosine_ops`) for approximate nearest-neighbour search. HNSW offers better recall and query latency than IVFFlat at the cost of higher memory usage — the right trade-off for a production system where retrieval quality directly affects learning content quality.

### Redis

Used for two purposes:
- **BullMQ job queues** — content ingestion pipeline
- **Cache / session storage** — JWT refresh token storage, rate limiting

### Core Entities

| Entity | Purpose |
|---|---|
| `User` | Account, email, bcrypt password hash, global preferences, role (user/admin) |
| `Certification` | Supported exam (name, provider, domain list, question count, time limit) |
| `UserCertification` | Join entity: user enrollment in a cert — enrolled at, status (active/archived), per-cert session preference overrides |
| `ContentSource` | Registered source per certification (URL, type, last fetched, interval, enabled) |
| `ContentChunk` | Parsed text chunk with pgvector embedding, multi-domain tags (`{domain, confidence}[]` with a derived `primaryDomain`), source reference, content hash |
| `StudySession` | Session record (user, certification, config, start/end time, status, last item index) |
| `SessionItem` | Individual item within a session (type: reading/quiz/video, content, completed flag) |
| `QuizResponse` | User answer, correctness, confidence rating (1–5), time taken |
| `WeakArea` | Aggregated score per user, per certification, per domain — updated after each session and mock exam |
| `MockExam` | Full timed exam attempt per user and certification — overall score, domain breakdown, review data |
| `AgentConversation` | Agent chat session — either linked to a `StudySession` (lifecycle follows the session) or standalone (sliding 4-hour inactivity TTL) |
| `AgentMessage` | Individual message in a conversation — role (`user` \| `assistant` \| `tool` \| `system`), content stored as JSONB mirroring the Vercel AI SDK `CoreMessage` type (string or array of content parts). Tool call invocations and tool results are stored as separate messages to allow full conversation reconstruction. |

---

## API — `apps/api`

### Modules

**AuthModule**
- Email/password registration and login
- JWT access tokens (short-lived) + refresh tokens (stored in Redis)
- bcrypt for password hashing
- Guards applied globally, with per-route overrides for public endpoints

**UsersModule**
- User profile read/update
- Session default preferences (duration, content mix, difficulty, learning style)

**CertificationsModule**
- List all supported certifications
- Certification detail: domains, topic breakdown, exam format

**SessionsModule**
- Create and start a study session with config:
  - Duration (e.g. 15 / 30 / 60 / 90 min)
  - Content type mix (quizzes / reading / video-based)
  - Difficulty (beginner / intermediate / exam-ready)
  - Focus area (specific domains or auto from weak areas)
  - Learning style (spaced repetition / cram / weak-area focus)
- End session, record duration and completion status
- Compute and return end-of-session summary (accuracy, domain deltas, readiness score change, next session suggestion)
- Session history list with filters

**QuizModule**
- Generate quiz questions from semantically retrieved content chunks via LLM
- Accept user answers, score, and store with confidence rating
- Return explanations for wrong answers (agent-powered)

**MockExamModule**
- Create timed mock exam matching real exam format (question count, time limit)
- No agent access during exam
- Score and store full attempt on submission
- Review mode: see all questions with correct answers and explanations

**WeakAreasModule**
- Aggregate quiz performance per domain per user
- Expose ranked weak area list used by session planner and dashboard
- Updated after each session and mock exam

**AgentModule**
- Streaming Q&A agent via Vercel AI SDK, delivered over Server-Sent Events
- Two distinct agent modes:
  - **In-session agent** — full tool access, scoped to the session's certification (see tools below)
  - **Standalone agent** — a general-knowledge tutor with **no cert-scoped tools**. Because there is no certification or session context, none of the RAG/progress tools below apply (they all require a cert corpus or session). It answers from the model's general knowledge only, grounded by the conversation. This keeps standalone chat simple and avoids implying cert-specific grounding it cannot provide.
- In-session agent tools:
  - `semanticSearch` — query content chunks by embedding similarity
  - `fetchMoreMaterial` — expand a topic. **Fast path (default):** generate from chunks already in the knowledge base, inline within the agent turn (no worker job) — this handles the majority of cases. **Slow path:** when chunk coverage is genuinely thin, enqueue a high-priority worker ingestion job and return its `jobId`. The frontend subscribes to that job's BullMQ events over the agent SSE channel; on completion the agent re-runs `semanticSearch` and continues. The new content does not arrive synchronously in the same turn.
  - `explainAnswer` — structured explanation of a quiz answer with source citation
  - `examStrategy` — advice on question type approach or domain strategy
  - `getUserProgress` — retrieve the user's current exam readiness score, per-domain weak area scores, and confidence ratings; used to give personalized study recommendations
  - `getSessionHistory` — retrieve recent session and mock exam history including accuracy trends per domain; used to contextualize answers about performance and improvement

**UserCertificationsModule**
- Enroll a user in a certification (creates `UserCertification`)
- Update per-cert session preference overrides
- Archive / restore a certification enrollment
- List a user's active and archived certifications

**ContentModule** (admin-facing)
- Register and manage content sources per certification
- Trigger manual re-ingestion of a source
- View ingestion job status

**AdminModule** (admin-facing)
- List all users with role and enrollment counts
- Promote / demote users between `user` and `admin` roles

### API conventions
- REST with JSON
- Versioned under `/api/v1`
- Global validation via `class-validator` / `class-transformer`
- Errors follow RFC 7807 Problem Details format (enforced via global `ExceptionFilter`)

### Response structure

All responses follow a consistent JSON:API-inspired envelope, enforced via a global `ResponseInterceptor` in NestJS. Shared generic DTOs live in `packages/shared`.

**Single resource** — flat attributes, with a `relationships` block containing hrefs to related resources. Note: user-specific data such as `readinessScore` lives on `UserCertification`, not `Certification`:
```json
{
  "data": {
    "id": "1",
    "certificationId": "abc",
    "name": "AWS Cloud Practitioner",
    "readinessScore": 75,

    "relationships": {
      "weakAreas": { "href": "/api/v1/user-certifications/1/weak-areas" },
      "sessions": { "href": "/api/v1/user-certifications/1/sessions" }
    }
  }
}
```

**`?include=` expansion** — related resources embedded inline within the relationship object. To avoid a combinatorial explosion of response schemas (2ⁿ for n includable relations), a resource has **one** response schema in which each relationship's `data` field is independently **optional/nullable**; its presence at runtime depends on the `include` param. Orval generates a single composable and consumers null-check the included fields. (This replaces a per-combination-schema approach, which does not scale as includable relations grow.)
```json
{
  "data": {
    "id": "1",
    "certificationId": "abc",
    "name": "AWS Cloud Practitioner",
    "readinessScore": 75,
    "relationships": {
      "weakAreas": {
        "href": "/api/v1/user-certifications/1/weak-areas",
        "data": [
          { "id": "a", "domain": "Billing", "score": 48 },
          { "id": "b", "domain": "Security", "score": 61 }
        ]
      }
    }
  }
}
```

**Collection (paginated):**
```json
{
  "data": [ ... ],
  "meta": { "total": 100, "page": 1, "limit": 20 }
}
```

**Error (RFC 7807):**
```json
{
  "type": "/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "Email is already taken",
  "errors": [ { "field": "email", "message": "..." } ]
}
```

No sparse fieldsets in v1 — YAGNI.

**Pagination defaults:** Default page size is **25**. Individual UI pages override this via query param (`?limit=N`). Maximum allowed limit is 100.

### Typed client generation (Orval)

`@nestjs/swagger` generates an OpenAPI spec from NestJS decorators. Orval reads that spec and generates fully typed Vue Query composables for `apps/web`. The generated client is **committed to the repository** — `yarn codegen` is run locally during development when the API changes, not in CI. CI uses the committed generated files. `@nestjs/swagger` and its Swagger UI are disabled in production; in development the raw OpenAPI JSON is available at `/api-json` for Orval to consume.

### Endpoint naming

| Pattern | Usage |
|---|---|
| `GET /api/v1/:resource` | List (paginated) |
| `GET /api/v1/:resource/:id` | Single resource |
| `POST /api/v1/:resource` | Create |
| `PATCH /api/v1/:resource/:id` | Partial update |
| `DELETE /api/v1/:resource/:id` | Delete |
| `POST /api/v1/:resource/:id/:action` | Actions (e.g. `/sessions/:id/end`) |

---

## Content Pipeline — `apps/worker`

A NestJS application with no HTTP server. Runs BullMQ processors and scheduled cron jobs.

### Source Types & Fetch Strategy

| Source type | Fetch method |
|---|---|
| Official docs / web pages | HTTP request to scrapper service → clean text/markdown |
| Whitepapers / PDFs | scrapper service (with PDF support) or `pdf-parse` fallback |
| YouTube | `youtube-transcript` package (no browser required); each transcript segment's start offset is captured and stored as chunk metadata so video items can deep-link to a timestamp |
| Reddit | Reddit public JSON API (no auth required for public subreddits) |
| Community guides (GitHub) | GitHub API for repo discovery + raw Markdown fetch |
| Anki / Quizlet | Quizlet public API or scrape via scrapper; Anki shared deck exports |
| Podcast transcripts | RSS feed parsing + transcript fetch where available |

### Scrapper Sidecar

`amerkurev/scrapper` (or equivalent) runs as a sidecar container in the worker pod. The worker calls it via HTTP to fetch and clean web content, keeping Playwright and browser dependencies out of the worker process entirely.

### Processing Pipeline (per source)

1. Fetch raw content via appropriate method
2. Clean and normalize text
3. Split into ~500-token chunks with overlap
4. **Domain tagging** — LLM (utility model) classifies each chunk against the certification's domain list. Multiple domains are stored per chunk as `{domain, confidence}` entries for every domain above a confidence threshold (cert material routinely straddles domains — e.g. IAM is both Security and Architecture). The highest-confidence entry is recorded as `primaryDomain` for display, sorting, and weak-area attribution; retrieval matches against any tagged domain
5. Generate embeddings via Vercel AI SDK
6. Upsert chunks into `content_chunks` with source reference, domain tag, and metadata (content hash used as upsert key to avoid duplicates on re-ingestion)

### Scheduling

- `@nestjs/schedule` cron job re-enqueues stale sources on a configurable interval (default: weekly per source)
- Admin-triggered re-ingestion enqueues immediately via the API
- On-demand fetch (from agent `fetchMoreMaterial` tool) enqueues a high-priority job
- Cleanup cron: marks `StudySession` records in `active` status older than 24 hours as `abandoned`
- Cleanup cron: soft-deletes standalone `AgentConversation` records past their sliding 4-hour inactivity TTL. Session-linked conversations are not handled here — they are retired together with their `StudySession` by the session-abandonment cleanup above.

### BullMQ

- Separate queue per source type
- Automatic retries with exponential backoff (important for rate-limited sources)
- Job events emitted for status visibility in admin UI

---

## Frontend — `apps/web`

NuxtJS (Vue 3) with Nuxt UI (component library), TailwindCSS, and Pinia.

**Visual style:** Clean and minimal — low visual noise, keeps the learner focused on content. Dark mode supported from day one (Nuxt UI handles this natively). Light/dark toggle available in the user preferences.

### Layout Decisions

**Session view — Split Panel**
Content (reading block or quiz card) on the left, AI agent chat panel on the right. Both always visible. Agent panel is collapsible to give content more space when not in use.

**Dashboard — Vertical cert list**
All enrolled certifications stacked vertically, each as a card showing:
- Certification name and provider
- Readiness score with delta since last session
- Weak areas (top 3 domains with scores)
- Recent sessions (last 3, with domain and accuracy)
- Start Session and Mock Exam quick-start buttons

The certification with the lowest readiness score gets the gradient hero treatment at the top of the list — it needs the most attention. Other certs are shown in a muted style below, sorted by readiness score ascending. An "+ Add certification" entry sits at the bottom of the list.

### Pages

**Onboarding**
- Select target certification
- Configure default session preferences (duration, content mix, style)
- **No-certifications case:** onboarding is skipped entirely when no certifications exist yet. The first registered user (an admin) is routed straight to the admin certification-setup flow instead; a non-admin who somehow arrives with zero available certs sees an empty state ("No certifications available yet") rather than a dead-end cert picker

**Dashboard**
- Exam readiness score (prominent, e.g. "75% ready")
- Suggested next session based on weak areas and last session
- Weak area summary (domain performance rings/bars)
- Recent session history
- Quick-start buttons (study session / mock exam)

**Session view**
- Split panel: content (reading blocks and quiz cards) on the left, AI agent chat on the right
- Agent panel is collapsible to maximise content area
- Confidence rating (1–5) after each topic block
- Session timer and progress bar in the header
- Transitions to end-of-session summary on completion

**Mock exam**
- Full-screen timed exam
- No agent access
- Question navigation sidebar
- Submit → score breakdown by domain → review mode

**Progress**
- Weak area breakdown per domain with trend over time
- Historical quiz accuracy charts
- Session history with per-session stats

**Agent chat**
- Standalone Q&A interface outside of sessions — a general-knowledge tutor with no certification context and no cert-scoped tools
- Streaming responses via SSE
- No inline source citations here (no RAG corpus is attached); citations only appear in the in-session agent

**Admin**
- Certification setup: admin enters a cert name or code, an LLM agent pre-fills domains, weights, exam format, and suggested content sources; admin reviews and confirms
- Manual certification form for unknown or new certs with no LLM knowledge
- Content source management per certification (add, enable/disable, trigger re-ingestion)
- Ingestion job status and manual trigger
- User management: list all users, promote / demote admin role

### Streaming

Agent responses streamed via the native `useEventSource` composable, consuming the SSE endpoint exposed by the NestJS API.

### Agent Tool Result Rendering

Tool results that surface data meaningful to the user are rendered as formatted UI components inline in the chat, rather than having the agent describe them in prose. The frontend inspects the tool name on each message part and renders the appropriate component.

| Tool | UI treatment |
|---|---|
| `getUserProgress` | Mini domain score bars with readiness percentage chip |
| `getSessionHistory` | Compact list of recent sessions with domain and accuracy |
| `explainAnswer` | Formatted explanation card with correct answer highlighted and source citation chip |
| `examStrategy` | Tip card with icon, distinct from regular chat bubbles |
| `fetchMoreMaterial` | Fast path: expanded content rendered inline. Slow path: loading state ("Fetching more content…") → "job enqueued" chip → "new material ready" chip when the job-completion event arrives over SSE |
| `semanticSearch` | Not shown — internal lookup that informs the agent's text response only |

---

## Authentication & Authorisation

- Email + password registration and login
- Passwords hashed with bcrypt
- JWT access token (15 min expiry) + refresh token (7 days, stored in Redis)
- Refresh token rotation on use
- **Token transport:** the refresh token is delivered as an `httpOnly`, `Secure`, `SameSite=Lax` cookie — never exposed to JavaScript. The short-lived access token is held in memory in Pinia (not `localStorage`) and re-obtained via silent refresh against the cookie. State-changing requests carry CSRF protection (CSRF token + `SameSite`), and CORS is configured with `credentials: true` against the explicit frontend origin (never `*`).

### Resource ownership (object-level authorization)

Authentication and the `RolesGuard` are not sufficient on their own — every user-scoped resource (`UserCertification`, `StudySession`, `SessionItem`, `QuizResponse`, `MockExam`, `AgentConversation`, …) must be guarded so a user can only access their own records. Ownership is enforced at the repository layer by scoping every query on `userId` (rather than fetching a row and then checking ownership, which doubles the query). For nested resources (e.g. `/user-certifications/:id/sessions`) the parent's ownership is verified as part of the same scoped query. Cross-user access returns `404`, not `403`, to avoid leaking the existence of others' resources.

### Roles

Two roles: `user` (default) and `admin`. Stored as an enum on the `User` entity.

- The first user to register is automatically assigned the `admin` role
- Admins can promote any user to `admin` via the admin panel
- Admin-only routes are protected by a dedicated `RolesGuard`

---

## Infrastructure

### Local Development

Docker Compose services:
- `postgres` — PostgreSQL with pgvector extension
- `redis` — Redis
- `scrapper` — amerkurev/scrapper

Apps run as native Node processes via Yarn workspace scripts.

### Kubernetes (Production)

| Component | K8s resource |
|---|---|
| `apps/api` | Deployment + ClusterIP Service |
| `apps/web` | Deployment + LoadBalancer / Ingress |
| `apps/worker` | Deployment (no ingress); scrapper as sidecar container |
| PostgreSQL | Managed external (e.g. Cloud SQL, Neon, RDS with pgvector) |
| Redis | Managed external (e.g. Upstash, Redis Cloud) |

- Each app has its own `Dockerfile` at `apps/<name>/Dockerfile`
- Base manifests in `k8s/` directory
- Config via `ConfigMap`; secrets via `Secret`
- Each app's env vars documented in its own `.env.example`

### Database Migrations

MikroORM migrations run as a Kubernetes `Job` managed by ArgoCD on each deploy. The job runs `mikro-orm migration:up` against the production database before the new API and worker pods are started. ArgoCD resource hooks (`pre-sync`) ensure ordering.

### CI/CD — GitHub Actions

**On push to `main`:**
- Build Docker image for each app (`apps/api`, `apps/web`, `apps/worker`)
- Tag images with the branch name (e.g. `main`) — ArgoCD Image Updater detects the digest change and triggers a rollout
- Push images to the container registry

**On pull request:**
- Typecheck (`tsc --noEmit`) across all apps and packages
- Lint and format check (`biome check`)
- Unit and integration tests (`vitest run`) with Testcontainers
- Build all apps to catch compilation errors

All workflows defined under `.github/workflows/`.

---

## Observability

### Structured Logging — Pino
`nestjs-pino` provides structured JSON logging across `apps/api` and `apps/worker`. Log level configurable via env var. Request logging via `pino-http` middleware.

### Metrics — Prometheus
`@willsoto/nestjs-prometheus` exposes a `/metrics` endpoint on the API and worker for Prometheus scraping. Key metrics:
- HTTP request latency and status codes
- LLM call latency, token usage, and error rates per model/use-case
- BullMQ queue depth and job processing time per queue
- Content chunk ingestion count per source type
- Active session count

### Distributed Tracing — OpenTelemetry
`@opentelemetry/sdk-node` with auto-instrumentation for NestJS, MikroORM, and HTTP clients. Traces exported to an OTEL collector (configurable via env). Spans cover:
- Incoming API requests
- LLM calls (latency, model, token counts)
- Database queries
- BullMQ job processing
- Scrapper HTTP calls

### Error Reporting — Sentry

`@sentry/nestjs` on the API and worker, `@sentry/nuxt` on the frontend. Captures unhandled exceptions and sends them to Sentry with full stack traces, request context, and user identity. DSN configured via env var. Source maps uploaded as part of the CI build step so Sentry stack traces map back to TypeScript source.

### Health Checks
`@nestjs/terminus` exposes `GET /health` on the API with checks for:
- PostgreSQL connectivity
- Redis connectivity
- Disk storage threshold

Used as k8s liveness and readiness probes.

---

## Configuration

`@nestjs/config` with a Zod schema validates all environment variables at startup. The app fails fast with a clear error if required config is missing or malformed. Each app (`api`, `worker`) has its own validated config schema. Shared env var definitions live in `packages/shared`.

Key config groups:
- Database (Postgres connection URL)
- Redis (connection URL)
- JWT (secret, access/refresh token expiry)
- AI provider (provider name, API key, model IDs per task type, embedding model). The embedding **dimension is not runtime config** — it is fixed by the pgvector column at migration time. On boot the app reads the live column dimension and fails fast if the configured embedding model's output dimension does not match it
- Scrapper (base URL)
- CORS (allowed origins)
- Email (SMTP2GO host, port, username, password, from address)
- Sentry (DSN)
- Observability (OTEL endpoint, log level, Prometheus port)
- Rate limiting (throttler TTL and limit overrides)
- Content pipeline (similarity threshold, chunk size, staleness interval overrides)

---

## Rate Limiting

`@nestjs/throttler` with Redis storage (reuses the existing Redis instance). Different limits per route category:

- **Auth endpoints** (`/auth/login`, `/auth/register`) — strict: 10 requests / 15 min per IP
- **Agent SSE endpoint** — per-user: 30 requests / min
- **General API** — per-user: 300 requests / min

Throttler guards applied globally with per-route overrides via decorator.

---

## Security Headers

`helmet` middleware applied globally on the NestJS API. Sets CSP, HSTS, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy headers. CSP configured to allow SSE connections from the API origin and assets from the NuxtJS frontend.

---

## Email

SMTP2GO as the email provider via `nodemailer`. A dedicated `MailModule` in `apps/api` wraps nodemailer with a typed service for sending transactional emails. Templates are plain text + HTML.

**Emails sent in v1:**
- Password reset link (expires in 1 hour)
- Welcome email on registration

SMTP credentials configured via env vars.

---

## Password Reset Flow

1. User submits their email to `POST /api/v1/auth/forgot-password`
2. API generates a signed, time-limited reset token (1 hour TTL), stores it in Redis, sends the reset link via email. The link points at a **frontend** route (e.g. `/reset-password?token=...`) — the user never sees a backend URL
3. The frontend reset page validates the token by calling the API (`GET /api/v1/auth/reset-password?token=...`) and renders the new-password form on success
4. User submits a new password to `POST /api/v1/auth/reset-password`
5. Password updated, reset token invalidated in Redis

---

## CORS

NestJS is configured to accept requests only from the NuxtJS frontend origin (set via env var). In development, `http://localhost:3000` is allowed. In production, the Ingress handles TLS termination and the CORS origin is set to the app's public domain.

---

## Testing Strategy

Outside-in TDD: tests are written starting from user-facing behavior and worked inward to implementation. A failing e2e test defines the goal; integration and unit tests are added as each layer is implemented.

### Layers

**E2E — Playwright**
Full user journey tests against the running app. Written first to define acceptance criteria. Examples: "user completes a study session", "mock exam scores correctly", "agent answers a question with source citation". Uses `@nuxt/test-utils` Playwright integration.

**API integration — Vitest + Supertest + `@nestjs/testing`**
Tests NestJS modules against a real database. `@nestjs/testing` boots a real module context; Supertest fires HTTP requests against it. Pins API contracts before implementing handlers. No mocking of the database — integration tests must hit real Postgres and Redis.

**Unit — Vitest**
Fast, isolated tests for pure logic: quiz scoring, weak area score calculation, session config building, content chunking and token splitting, embedding pipeline steps.

**Frontend components — Vitest + `@nuxt/test-utils` + Vue Test Utils**
Component tests for anything with non-trivial logic: quiz card state, confidence rating interaction, agent chat streaming state, session timer.

### Tooling

- **Vitest** — single test runner across all apps and packages. ESM-native, fast, Jest-compatible API.
- **SWC** (`@swc/core` + `unplugin-swc`) — replaces `tsc` for NestJS compilation and Vitest transformation. Significantly faster builds and test runs in `apps/api` and `apps/worker`.
- **Playwright** — e2e test runner with `@nuxt/test-utils` integration for `apps/web`.
- **Supertest** — HTTP assertions for NestJS integration tests.
- **Testcontainers** — spins up real Postgres (with pgvector) and Redis containers for integration and e2e tests. Tests are fully isolated and reproducible without a pre-running dev environment. Used in both local development and CI.

### Coverage

Minimum **80% line and branch coverage** enforced via Vitest's built-in coverage reporter (`@vitest/coverage-v8`). Coverage is checked in CI on pull requests and fails the build if the threshold is not met. E2E tests are excluded from coverage measurement.

### Structure

Each app has its own `vitest.config.ts`. E2E tests live in `apps/web/e2e/`. Unit and integration tests co-locate with source files (`*.spec.ts`).

---

## Content Architecture

The system operates on two distinct content layers that work together to deliver personalized learning.

### Layer 1: Ingested Content (Knowledge Base)

Pre-fetched from external sources by the worker pipeline, chunked, embedded, and stored in `content_chunks`. This is shared ground truth — the same chunks serve all users of a certification. Refreshed periodically by the worker or on-demand via admin trigger.

### Layer 2: Generated Content (Personalized, On-Demand)

The LLM uses retrieved chunks as context to generate content tailored to each individual user — quiz questions at their difficulty level, explanations suited to their background, analogies, deeper dives, extra examples. Personalization happens entirely at this layer, not at the ingestion layer.

This means:
- Two users studying the same cert share the same knowledge base but receive different sessions because their weak areas, confidence, and config drive *which* chunks and domains are selected and at what difficulty. Generated text for a given `chunk(s) + difficulty + format` is shared and cacheable across users (see LLM Cost Optimisation); personalization lives in selection, not in re-generating the same chunk differently per user
- The session generator, quiz engine, and agent all produce fresh output each time, grounded in ingested chunks

### "Generate More Material" Strategy

When a user or the agent determines a topic needs more depth, the system tries these in order:

1. **Generate from existing chunks (fast path)** — the LLM expands the topic using chunks already in the knowledge base, inline within the request/agent turn (immediate, no new ingestion). Handles the majority of cases.
2. **Fetch new source content (slow path)** — if chunk coverage for the topic is genuinely thin (determined by low semantic search scores), a high-priority ingestion job is enqueued. This is asynchronous and cannot complete within the originating turn: the caller receives a `jobId`, the frontend subscribes to that job's BullMQ events over the agent SSE channel, and on completion the agent re-queries the now-richer knowledge base. New ingestion is reserved for genuine gaps.

---

## AI / LLM Integration

All LLM calls go through the **Vercel AI SDK** to remain provider-agnostic. The configured provider is set via environment variable (e.g. `AI_PROVIDER=anthropic`).

LLM is used for:
- **Quiz generation** — given retrieved content chunks + certification domain context, produce N multiple-choice questions with distractors and correct answers
- **Answer explanation** — given a question, the user's answer, and the correct answer, produce a detailed explanation with source reference
- **Agent responses** — streaming chat with access to semantic search and content fetch tools
- **On-demand material generation** — expand a thin topic with additional examples, analogies, or explanations

Embeddings are generated via the Vercel AI SDK. The embedding provider is configured independently from the chat provider — they do not need to match. This is important because some chat providers (e.g. Anthropic) offer no embedding model. The default embedding model is **OpenAI `text-embedding-3-small`** (1536 dimensions, fast, cost-effective for bulk chunk ingestion). This can be swapped for `text-embedding-3-large` or Voyage AI's `voyage-3` if retrieval quality needs improvement, but only via a migration that alters the `content_chunks` embedding column dimension — the dimension is not a runtime-tunable setting. The app validates the configured model's dimension against the live column on startup and refuses to boot on a mismatch.

### Model Selection Strategy

Not all LLM tasks require the same model. Models are chosen by task type to balance quality and cost:

| Task | Model type |
|---|---|
| Quiz generation, answer explanation | Utility model (fast, cheap — e.g. Haiku, GPT-4o mini) |
| Agent Q&A responses | Mid-tier model (e.g. Sonnet, GPT-4o) |
| Certification pre-fill in admin | Mid-tier model |
| Domain tagging of content chunks | Utility model |
| On-demand material generation | Mid-tier model |
| Complex reasoning tasks | Thinking model (e.g. Claude with extended thinking, o1) |

Model IDs are configured via env vars per task type, not hardcoded.

### LLM Cost Optimisation

- **Response caching** — quiz questions and explanations are cached in Redis with a TTL, keyed on the full set of inputs that determine the output: source chunk id(s), difficulty, question format, and certification. Any user-specific input that influences generation must be part of the cache key — otherwise it must not be part of the prompt. Per-user tailoring is therefore expressed as content *selection* (which chunks/domains a user sees), not as variation in the generated text for a given chunk, which keeps the cache effective across users. Identical requests within the TTL return the cached response without an LLM call.
- **Prompt caching** — use provider prompt caching (e.g. Anthropic cache control) for large static context like certification domain lists and system prompts sent repeatedly.
- **Token budgets** — each LLM call type has a configured max token budget to prevent runaway costs.
- **Embedding batching** — content chunks are embedded in batches during ingestion rather than one-by-one.

---

## Session Item Generation

When a user starts a study session, items are pre-generated before the session begins. A brief "preparing your session" screen is shown. The first 3 items are generated immediately (blocking); remaining items are generated in the background during the session so there are no waits mid-study.

### Item sequencing

Sessions alternate between reading blocks and quiz cards:
```
reading block → quiz questions → reading block → quiz questions → ...
```

The number of items is derived from session duration (~2 min per reading block, ~1 min per quiz question). A 30-min session yields roughly 4 reading blocks and 12 quiz questions.

### Content selection

1. Target domains are determined from the session's focus area config (explicit domain, or auto-weighted by weak area scores)
2. Semantic search retrieves the most relevant content chunks above a minimum cosine similarity threshold of **0.75** (configurable via env). Chunks below this threshold are discarded even if they are the nearest neighbours.
3. Reading blocks are composed from 1–3 related chunks, formatted by the LLM into clean readable **Markdown prose** — not raw scraped text. The frontend renders Markdown to HTML. The goal is digestible explanations, not raw documentation dumps.
4. For video-based content mix, session items include a **YouTube embed** deep-linked to a timestamp (`?t=<seconds>`), followed by quiz questions generated from the video's transcript chunks. The timestamp is not derived at session time — it is the transcript-segment start offset captured as chunk metadata during ingestion (see Content Pipeline). "Video-based" means *prefer video where available*, not *require video*: if a target domain has no video-sourced chunks above the similarity threshold, that item degrades silently to a normal reading block so the session is never broken or empty.
5. Quiz questions are generated by the LLM from the same chunks used in the adjacent reading block, reinforcing the material just read.

### Quiz question formats

Sessions support mixed question types:
- **Multiple choice** — 4 options, one correct answer (most common)
- **True / False** — for clear-cut factual statements
- **Scenario-based** — longer stem describing a real-world situation, 4 options (used at exam-ready difficulty)

The LLM selects the most appropriate format per question based on the content chunk and difficulty level.

### Session resume

`StudySession` tracks a `lastItemIndex` and per-item completion flags. If a user navigates away or refreshes, the session remains in `active` status. On returning to the session view, the app resumes from the last incomplete item. Sessions in `active` status older than 24 hours are automatically marked `abandoned` by a cleanup cron job.

---

## Agent Context

The agent's system prompt is constructed per-session and designed for prompt caching.

Agent conversations are persisted as `AgentConversation` + `AgentMessage` entities.

- **In-session chats** are linked to the `StudySession` and carry the full cert-scoped tool set and static context below. They have no independent timeout — their lifecycle follows the session: retained while the session is `active`/`completed`, and cleaned up when the session-abandonment cron retires the session (sessions `active` > 24h → `abandoned`).
- **Standalone "free chat"** creates a dedicated conversation that is a general-knowledge tutor with no certification context and no cert-scoped tools. It uses a **sliding 4-hour TTL** refreshed on each message; once inactive past the TTL it is soft-deleted by a cleanup cron job.

All message types are persisted — user messages, assistant text responses, tool call invocations, and tool results — each as a separate `AgentMessage` row with JSONB content mirroring the Vercel AI SDK `CoreMessage` format. When resuming a conversation, the full ordered message array is fetched and passed directly to the SDK, reconstructing the exact conversation state.

**Static context (prompt-cached, stable per certification):**
- Certification name, provider, exam format (question count, time limit, passing score)
- Full domain list with weights
- Exam strategy guidelines for this certification

**Semi-static context (prompt-cached, stable per user session):**
- User's top 5 weak area domains with current scores
- Current exam readiness score
- Active session domain focus (if in-session)

**Dynamic context (via tools, fetched on demand):**
- Full session history and accuracy trends — via `getSessionHistory`
- Specific question or answer details — via `explainAnswer`
- Additional content on a topic — via `semanticSearch` or `fetchMoreMaterial`
- Full progress breakdown — via `getUserProgress`

The rule: if it changes per-request, use a tool. If it's stable for the duration of a session, put it in the system prompt with prompt caching. This keeps the static context tokens cheap on repeated calls.

---

## Certification Enrollment

Users enroll in certifications via two entry points:
1. **Onboarding** — first cert enrolled during the initial setup flow after registration. Onboarding is only reachable when at least one certification exists; otherwise it is skipped (see Onboarding page — admins go to cert setup, others see an empty state)
2. **Dashboard** — "+ Add certification" button triggers an enrollment modal: pick from available certifications, optionally override session defaults for this cert

Enrollment creates a `UserCertification` record. Each cert on the dashboard maps to one `UserCertification`. Users can archive (not delete) a cert enrollment to remove it from the active dashboard view while preserving history.

---

## Content Staleness

Each `ContentSource` has a configurable re-check interval. Default intervals by source type:

| Source type | Default interval | Notes |
|---|---|---|
| Official docs / web pages | Weekly | AWS/Azure docs update frequently |
| YouTube | Weekly | New video discovery only — existing transcripts are not re-ingested |
| Reddit | Weekly | New top posts only |
| GitHub community guides | Bi-weekly | |
| Whitepapers / PDFs | Monthly | Very stable |
| Anki / Quizlet | Monthly | |
| Podcast transcripts | Weekly | |

Per-source interval can be overridden in the admin. A source is considered stale when `now > last_fetched + interval`. The cron job checks for stale sources every hour and enqueues re-ingestion jobs for any it finds.

---

## Session Personalization

Users configure sessions with:

| Parameter | Options |
|---|---|
| Duration | 15 / 30 / 60 / 90 min |
| Content mix | Quiz-heavy / Reading-heavy / Balanced / Video-based |
| Difficulty | Beginner / Intermediate / Exam-ready |
| Focus area | Auto (from weak areas) / Specific domain(s) |
| Learning style | Spaced repetition / Cram / Weak-area focus |

Session defaults are saved on the user profile. Per-session overrides are supported.

---

## Weak Area Tracking

After each session or mock exam, `WeakArea` records are updated per domain:
- Calculated from quiz accuracy and confidence ratings combined
- Surfaced on the dashboard and used to bias session content selection
- Session planner weights content retrieval toward weak domains when style is set to weak-area focus

---

## Exam Readiness Score

A single percentage (0–100%) shown prominently on the dashboard and progress page, representing how prepared the user is for their target certification exam.

Computed from:
- Per-domain weak area scores, weighted by the domain's share of the real exam (e.g. AWS CCP: Cloud Concepts 26%, Security 25%, etc.)
- Mock exam scores factored in with higher weight than regular session quiz scores
- Recency-weighted so recent improvement is reflected quickly

The score updates after every session and mock exam. The exact formula is left flexible for tuning during implementation — the intent is a number that moves meaningfully with effort and honestly reflects readiness.

---

## End-of-Session Summary

After every study session or mock exam, the user sees a summary screen before returning to the dashboard:

- Questions answered and accuracy for that session
- Domains covered, with per-domain accuracy
- Weak area score deltas ("Security +4%, Billing −1%")
- Exam readiness score change ("72% → 75% ready")
- Strongest and weakest question of the session, with the option to ask the agent about either
- A suggested focus for the next session based on updated weak areas

---

## Supported Certifications

Certifications are data-driven and added via the admin interface without code changes. The domain list and domain weights (used for the readiness score) are configured per certification.

### Primary Targets

**AWS**
- Cloud Practitioner (CLF-C02)
- Solutions Architect Associate (SAA-C03)
- Developer Associate (DVA-C02)
- SysOps Administrator Associate (SOA-C02)
- DevOps Engineer Professional (DOP-C02)
- Solutions Architect Professional (SAP-C02)
- AI Practitioner (AIF-C01)
- Machine Learning Engineer Associate (MLA-C01)
- Machine Learning Specialty (MLS-C01)

**Azure**
- AZ-900: Azure Fundamentals
- AZ-104: Azure Administrator
- AZ-204: Azure Developer
- AZ-305: Solutions Architect Expert
- AZ-400: DevOps Engineer Expert
- AI-900: Azure AI Fundamentals
- AI-102: Azure AI Engineer Associate
- DP-100: Azure Data Scientist Associate

**Kubernetes**
- CKA: Certified Kubernetes Administrator
- CKAD: Certified Kubernetes Application Developer
- CKS: Certified Kubernetes Security Specialist

**AI / ML (vendor-neutral)**
- TensorFlow Developer Certificate
- Databricks Certified Machine Learning Associate
- Google Cloud Professional Machine Learning Engineer
- Hugging Face certifications

### Planned Extensions

- Google Cloud: Cloud Digital Leader, Associate Cloud Engineer, Professional Cloud Architect
- HashiCorp Terraform Associate
- CompTIA: Security+, Network+, Linux+
