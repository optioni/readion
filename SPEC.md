# Readion — Specification

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
| Web search | Configurable search API (e.g. Tavily / Brave) — used for official-guide discovery during certification setup |
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
readion/
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
| `User` | Account, email, `emailVerified` flag, bcrypt password hash, global preferences (incl. display timezone — default `Europe/Helsinki`), role (user/admin), soft-delete marker for account deletion |
| `Certification` | Supported exam (name, provider, domain list with weights, question count, passing score, time limit). Exam-format fields are structured (never generated at question time) and carry provenance — `verified` (seed data) or per-field citation to the official exam guide — plus a `verifiedAt` date used for metadata-staleness re-verification (see Certification Setup & Grounding) |
| `UserCertification` | Join entity: user enrollment in a cert — enrolled at, status (active/archived), per-cert session preference overrides |
| `ContentSource` | Registered source per certification (URL, type, last fetched, interval, enabled) |
| `ContentChunk` | Parsed text chunk with pgvector embedding, multi-domain tags (`{domain, confidence}[]` with a derived `primaryDomain`), source reference, content hash, `state` (`active` \| `superseded`), `supersededById` (lineage to the chunk that replaced it). See Chunk Lifecycle & Reconciliation |
| `StudySession` | Session record (user, certification, config, start/end time, status, last item index, `kind`: `study` \| `review`) |
| `SessionItem` | Individual item within a session (type: reading/quiz/video, content, completed flag) |
| `QuizResponse` | User answer, correctness, confidence rating (1–5), time taken |
| `WeakArea` | Aggregated score per user, per certification, per domain — updated after each session and mock exam |
| `ReviewItem` | Spaced-repetition state for a concept (anchored to a content chunk) per `UserCertification` — Leitner `box`, `dueAt`, `lastReviewedAt`, `state` (`active` \| `mastered` \| `suppressed`) |
| `MockExam` | Exam attempt per user and certification — `type` (`mock` \| `diagnostic`), `status` (`in_progress` \| `submitted` \| `expired`), `startedAt`/`deadline` (wall-clock timer), overall score, domain breakdown, review data. `mock` = full real-exam format (timed, pass/fail); `diagnostic` = short calibration taken at enrollment (see Diagnostic Exam, Mock Exam Lifecycle) |
| `AgentConversation` | Agent chat session — either linked to a `StudySession` (lifecycle follows the session) or standalone (sliding 4-hour inactivity TTL) |
| `AgentMessage` | Individual message in a conversation — role (`user` \| `assistant` \| `tool` \| `system`), content stored as JSONB mirroring the Vercel AI SDK `CoreMessage` type (string or array of content parts). Tool call invocations and tool results are stored as separate messages to allow full conversation reconstruction. |
| `AuditLog` | Append-only record of privileged admin actions (role change, source add/disable, content quarantine, cert publish/re-verify) — actor, action, target, timestamp, before/after snapshot. Retained through user deletion but stripped of direct identifiers |

---

## API — `apps/api`

### Modules

**AuthModule**
- Email/password registration and login
- Email verification on registration — a verification link is emailed; the account carries an `emailVerified` flag and is prompted to confirm. Password reset and the verification flow are the two paths that prove address ownership
- JWT access tokens (short-lived) + refresh tokens (stored in Redis)
- bcrypt for password hashing
- Refresh tokens are revoked on password change, password reset, and account deletion (all of a user's outstanding sessions are invalidated)
- Guards applied globally, with per-route overrides for public endpoints

**UsersModule**
- User profile read/update, including display timezone (default `Europe/Helsinki`; all timestamps stored UTC)
- Session default preferences (duration, content mix, difficulty, learning style)
- Account deletion (`DELETE /api/v1/users/me`, password re-confirmation) — see Account Deletion

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
- Generate quiz questions from semantically retrieved content chunks via LLM, under the extractive-grounding contract + verifier pass (see Grounding & Verification) — unverified questions are never served
- Accept user answers, score, and store with confidence rating
- Return explanations for wrong answers (agent-powered), also grounded + verified
- Accept user "report" on a question/explanation → quarantine + cache eviction

**MockExamModule**
- Create timed mock exam matching real exam format (question count, time limit)
- No agent access during exam
- Wall-clock timer: questions stream into the navigation as they are generated and verified, but the `deadline` clock only starts once the full verified set is ready, so generation never eats exam time (see Mock Exam Lifecycle)
- Resumable within the deadline; on timer expiry the attempt auto-submits with unanswered questions scored as incorrect
- Score and store full attempt on submission
- Review mode: see all questions with correct answers and explanations
- Exam questions are generated under the same grounding + verifier guarantee as quizzes (see Grounding & Verification)
- Also owns the **diagnostic** variant (`type: diagnostic`): a short (10–15 question) calibration exam spread across all domains, no pass/fail, used to seed a new enrollment's baseline (see Diagnostic Exam). Shares scoring, domain-breakdown, and review infrastructure with mocks

**WeakAreasModule**
- Aggregate quiz performance per domain per user
- Expose ranked weak area list used by session planner and dashboard
- Updated after each session and mock exam

**ReviewModule**
- Owns the spaced-repetition queue (`ReviewItem` records) per `UserCertification`
- Accrues concepts from wrong / low-confidence answers (including diagnostic misses); applies the Leitner schedule on each review answer
- Exposes the due-item count and creates a `review`-kind `StudySession` for the standalone "5-minute review" (see Spaced Repetition & Review Queue)
- Mark-as-mastered / suppress endpoints to retire a concept from review and new-material selection

**AgentModule**
- Streaming Q&A agent via Vercel AI SDK, delivered over Server-Sent Events
- Two distinct agent modes:
  - **In-session agent** — full tool access, scoped to the session's certification (see tools below). System prompt enforces grounding: answer only from retrieved context, cite sources, and abstain rather than guess when material is thin (abstention can trigger `fetchMoreMaterial`) — see Grounding & Verification
  - **Standalone agent** — a general-knowledge tutor with **no cert-scoped tools**. Because there is no certification or session context, none of the RAG/progress tools below apply (they all require a cert corpus or session). It answers from the model's general knowledge only, grounded by the conversation. This keeps standalone chat simple and avoids implying cert-specific grounding it cannot provide.
- In-session agent tools:
  - `semanticSearch` — query content chunks by embedding similarity
  - `fetchMoreMaterial` — expand a topic. **Fast path (default):** generate from chunks already in the knowledge base, inline within the agent turn (no worker job) — this handles the majority of cases. **Slow path:** when chunk coverage is genuinely thin, enqueue a high-priority worker ingestion job and return its `jobId`. The frontend subscribes to that job's BullMQ events over the agent SSE channel; on completion the agent re-runs `semanticSearch` and continues. The new content does not arrive synchronously in the same turn. If the user navigates away before the job finishes, the ingested chunks are still persisted to the shared knowledge base and available to future turns and sessions — the work is never wasted.
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
- Every privileged action (role change, source add/disable, content quarantine, cert publish/re-verify) writes an `AuditLog` entry; the log is viewable in the admin panel

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

### Source Etiquette & Content Compliance

Ingestion is deliberately non-invasive — it prefers official/public APIs (already the default for Reddit, GitHub, and YouTube transcripts) and treats third-party content as something to *point at*, not republish wholesale:

- **Respect `robots.txt`** and source ToS — the scrapper honors crawl directives and disallowed paths are skipped.
- **Polite fetching** — outbound requests are rate-limited per source domain and identify with a descriptive User-Agent; no auth/paywall bypass (paid content is a non-goal).
- **Attribution is mandatory** — every chunk stores its source URL and is surfaced through citation chips that link back to the original, driving users *to* the source.
- **Quotation, not reproduction** — extractive `supportingSpans` are short quoted passages shown with attribution; reading blocks are LLM-composed prose grounded in chunks, never raw verbatim dumps of source pages. A configurable cap limits how much verbatim text any single item may surface.
- **Takedown path** — disabling a source supersedes its chunks and evicts dependent cache entries (see Chunk Lifecycle & Reconciliation), giving a clean removal route on a rights complaint.

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
- Cleanup cron: auto-submits and scores `MockExam` records left `in_progress` past their `deadline` (plus a short grace), marking them `expired` (see Mock Exam Lifecycle)
- Cleanup cron: hard-purges accounts whose deletion grace window has elapsed, cascading to all user-scoped records (see Account Deletion)
- Cleanup cron: hard-deletes `superseded` `ContentChunk`s past the retention window that no longer back any retained `SessionItem`/`MockExam` (see Chunk Lifecycle & Reconciliation)
- Cleanup cron: flags certifications whose `verifiedAt` has aged past the metadata-staleness interval as "due for re-verification" (see Certification Setup & Grounding)

### BullMQ

- Separate queue per source type
- Automatic retries with exponential backoff (important for rate-limited sources)
- Job events emitted for status visibility in admin UI

---

## Frontend — `apps/web`

NuxtJS (Vue 3) with Nuxt UI (component library), TailwindCSS, and Pinia.

**Visual style:** Clean and minimal — low visual noise, keeps the learner focused on content. Dark mode supported from day one (Nuxt UI handles this natively). Light/dark toggle available in the user preferences.

**Mobile & PWA:** The web app is fully responsive and installable as a Progressive Web App. Native apps remain a non-goal, but the time-constrained learner studies in fragmented moments (commute, between meetings), so phone-quality layouts and the quick "5-minute review" must work well on small screens. (No offline mode — see Non-Goals.)

### Layout Decisions

**Session view — Split Panel**
Content (reading block or quiz card) on the left, AI agent chat panel on the right. Both always visible. Agent panel is collapsible to give content more space when not in use.

**Dashboard — Vertical cert list**
All enrolled certifications stacked vertically, each as a card showing:
- Certification name and provider
- Readiness score with delta since last session
- Weak areas (top 3 domains with scores)
- Recent sessions (last 3, with domain and accuracy)
- Due-review count with a "5-minute review" quick-start (shown only when items are due)
- Start Session and Mock Exam quick-start buttons

The certification with the lowest readiness score gets the gradient hero treatment at the top of the list — it needs the most attention. Other certs are shown in a muted style below, sorted by readiness score ascending. An "+ Add certification" entry sits at the bottom of the list.

### Pages

**Onboarding**
- Select target certification
- Configure default session preferences (duration, content mix, style)
- Offer an optional **diagnostic exam** ("Take a 2-minute diagnostic to personalize your first session") with a clear Skip option (see Diagnostic Exam)
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
- Source citation chips on quiz cards and reading blocks (from stored provenance)
- "Report this question" action on quiz cards/explanations → quarantine (see Grounding & Verification)
- Session timer and progress bar in the header
- Transitions to end-of-session summary on completion

**Mock exam**
- Full-screen timed exam
- No agent access
- Question navigation sidebar
- Resumable within the deadline (wall-clock timer keeps counting); auto-submits on expiry (see Mock Exam Lifecycle)
- Submit → score breakdown by domain → review mode

**Progress**
- Weak area breakdown per domain with trend over time
- Historical quiz accuracy charts
- Session history with per-session stats
- Passive readiness trajectory ("at your recent pace, exam-ready in ~N weeks") — informational only, no dates or reminders
- Mark a concept or domain as **mastered** to retire it from review and new-material selection

**Agent chat**
- Standalone Q&A interface outside of sessions — a general-knowledge tutor with no certification context and no cert-scoped tools
- Streaming responses via SSE
- No inline source citations here (no RAG corpus is attached); citations only appear in the in-session agent

**Admin**
- Certification setup (see Certification Setup & Grounding): primary-target certs load from verified seed data; for new/unlisted certs the agent discovers candidate official-guide URLs via web search, the admin **confirms the source**, then the agent extracts each format field from that source with a per-field citation and an "unverified — confirm manually" flag on anything it couldn't ground. Admin reviews each field against its cited source and confirms
- Manual certification form for unknown or new certs with no LLM knowledge
- Content quality: review and manage **quarantined** generated items (reported by users or auto-flagged), with provenance
- Content source management per certification (add, enable/disable, trigger re-ingestion)
- Ingestion job status and manual trigger
- User management: list all users, promote / demote admin role
- Certs flagged "due for re-verification" (stale `verifiedAt`) are surfaced for a re-check
- Audit log of privileged actions (`AuditLog`), with actor, target, and before/after

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
- Verifier pass/fail rate, regeneration count per item, and substitution/abstention rate
- User-reported / quarantined item rate per certification
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
- Web search (provider, API key — used for certification-guide discovery)
- CORS (allowed origins)
- Email (SMTP2GO host, port, username, password, from address)
- Sentry (DSN)
- Observability (OTEL endpoint, log level, Prometheus port)
- Rate limiting (throttler TTL and limit overrides)
- Content pipeline (similarity threshold, chunk size, staleness interval overrides, superseded-chunk retention window)
- Lifecycle windows (account-deletion grace period, mock-exam auto-submit grace, certification metadata re-verification interval)
- Defaults (user display timezone — default `Europe/Helsinki`; readiness calibration threshold — min graded answers before a score is shown)

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
- Weekly progress digest (opt-out): readiness %, weekly delta, weakest domain, and due-review count, with a gentle prompt to continue. Encouraging in tone, never nagging; one-click unsubscribe
- Post-exam outcome nudge: after a user reaches exam-readiness and study activity lulls, a one-tap "Did you take the exam? Passed / Didn't pass / Not yet" survey (feeds the pass-rate metric; optional, at most one follow-up)

SMTP credentials configured via env vars.

All timestamps are stored and computed in **UTC**; user-facing times and the digest send-time are rendered in the user's display timezone (default `Europe/Helsinki`). The weekly-digest cron schedules each user's send relative to their stored timezone.

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
2. **Fetch new source content (slow path)** — if chunk coverage for the topic is genuinely thin (determined by low semantic search scores), a high-priority ingestion job is enqueued. This is asynchronous and cannot complete within the originating turn: the caller receives a `jobId`, the frontend subscribes to that job's BullMQ events over the agent SSE channel, and on completion the agent re-queries the now-richer knowledge base. New ingestion is reserved for genuine gaps. Because ingested chunks land in the shared knowledge base, the result persists even if the originating turn is abandoned — the next session or agent turn benefits from it.

---

## Chunk Lifecycle & Reconciliation

Many records point at a `ContentChunk` by id — `ReviewItem` anchors, cached questions, and the `sourceChunkIds`/`supportingSpans` persisted on `SessionItem` and `MockExam`. Because ingestion upserts by content hash, a source edit produces a *new* chunk rather than mutating the old one, so chunks must be reconciled on re-ingestion instead of accumulating forever or being hard-deleted out from under their dependents.

### Reconciliation on re-ingestion

After a source is re-fetched, the resulting chunk set is diffed against the source's existing chunks by content hash:

- **Unchanged** (hash still present) — kept as-is.
- **New** (hash not seen before) — inserted as `active`.
- **Disappeared** (previously present, no longer in the latest fetch) — marked `state: superseded` (soft delete), not physically removed. Where a clear successor exists (same source, overlapping span/section), `supersededById` records the lineage.

Superseded chunks are excluded from semantic retrieval and new generation but remain readable for history. A cleanup cron hard-deletes superseded chunks older than a retention window that no longer back any retained `SessionItem`/`MockExam`.

### Effect on dependents

- **Stored questions / reading blocks** (`SessionItem`, `MockExam`) already persist their `supportingSpans` and chunk ids as a **snapshot**, so historical sessions and exam reviews stay intact and faithful even if the underlying chunk is later superseded. A citation may resolve to a superseded chunk — that is correct for history.
- **Cache** — entries keyed on a chunk id are evicted when that chunk is superseded (same eviction path as a quarantine), so no stale generated content is served.
- **ReviewItem** — anchored to a *concept*, not hard-bound to one chunk row. If its anchor chunk is superseded, it re-anchors to `supersededById` where lineage exists; otherwise on the next due-generation it retrieves a fresh chunk for the same concept/domain via semantic search. If nothing above the similarity threshold remains, the item is held and may trigger `fetchMoreMaterial` rather than being silently dropped.

### Source removal & takedown

Disabling or deleting a `ContentSource` (including an honored takedown request) supersedes all of its chunks immediately and evicts dependent cache entries; `ReviewItem`s re-anchor or fall back to retrieval as above. Content removal therefore has a single, predictable path.

---

## Mock Exam Lifecycle

A mock exam is exam-faithful: timed, agent-free, and scored against the real pass mark. Its lifecycle differs from a study session because the timer is wall-clock and the format is fixed.

### Generation

The full question set is generated and independently verified (same grounding + verifier guarantee as session quizzes) behind a brief "preparing exam" screen. Questions may **stream into the navigation sidebar as each is verified** — quality is unaffected because every question is verified individually regardless of delivery order — but the `deadline` clock **only starts once the complete verified set is ready**, so generation latency never eats into exam time.

### Timer, resume & expiry

The timer is **wall-clock**: `deadline = startedAt + timeLimit`, computed server-side. A mock is **resumable** within its deadline — if the browser closes, elapsed time keeps counting (exam-faithful), and on return the user resumes with answers preserved and the clock where it should be. On reaching the deadline the attempt **auto-submits**, scoring unanswered questions as incorrect. A cleanup cron auto-submits any attempt left `in_progress` past its deadline (plus a short grace) and marks it `expired`.

The diagnostic variant shares this machinery but with a lenient/optional timer and no pass/fail framing (see Diagnostic Exam).

---

## Account Deletion

Users can delete their own account from preferences (`DELETE /api/v1/users/me`, password re-confirmation required). Deletion is two-stage:

1. **Soft delete (immediate)** — the account is marked deleted: refresh tokens are revoked, the email is released (freed for re-registration), and the user can no longer authenticate. A configurable grace window (default 14 days) allows support-assisted recovery.
2. **Hard purge (after grace window)** — a cleanup cron permanently removes the user and cascades to all user-scoped records: `UserCertification`, `StudySession`, `SessionItem`, `QuizResponse`, `MockExam`, `WeakArea`, `ReviewItem`, `AgentConversation`, `AgentMessage`. Shared `ContentChunk`s are untouched (they belong to no user). `AuditLog` entries are retained but stripped of direct identifiers.

Admin-initiated deletion follows the same path. Deleting the last remaining admin is blocked.

---

## AI / LLM Integration

All LLM calls go through the **Vercel AI SDK** to remain provider-agnostic. The configured provider is set via environment variable (e.g. `AI_PROVIDER=anthropic`).

LLM is used for:
- **Quiz generation** — given retrieved content chunks + certification domain context, produce N multiple-choice questions with distractors and correct answers
- **Answer explanation** — given a question, the user's answer, and the correct answer, produce a detailed explanation with source reference
- **Agent responses** — streaming chat with access to semantic search and content fetch tools
- **On-demand material generation** — expand a thin topic with additional examples, analogies, or explanations

Embeddings are generated via the Vercel AI SDK. The embedding provider is configured independently from the chat provider — they do not need to match. This is important because some chat providers (e.g. Anthropic) offer no embedding model. The default embedding model is **OpenAI `text-embedding-3-small`** (1536 dimensions, fast, cost-effective for bulk chunk ingestion). This can be swapped for `text-embedding-3-large` or Voyage AI's `voyage-3` if retrieval quality needs improvement, but only via a migration that alters the `content_chunks` embedding column dimension — the dimension is not a runtime-tunable setting. The app validates the configured model's dimension against the live column on startup and refuses to boot on a mismatch.

### Grounding & Verification

Generated study content must be faithful to source material — a study tool that teaches wrong answers is worse than none. Grounding has several layers.

**Two sources of truth, never blurred.**
- *Content facts* (what is true about the technology) come only from retrieved `ContentChunk`s.
- *Exam-format facts* (question count, passing score, time limit, domain list and weights) come only from structured `Certification` fields — they are **never generated at question time**. See Certification Setup & Grounding for how those fields are populated and trusted.

**Extractive generation contract.** The quiz/explanation generator must, for the correct answer, quote the supporting span(s) verbatim from the source chunk. If it cannot ground the answer in a quote, it must not assert it. Output is structured: question, options, correct answer, `supportingSpans[]`, `sourceChunkIds[]`.

**Independent verifier pass.** Before any question or explanation is shown *or cached*, a separate utility-model call checks that the correct answer is entailed by the cited span and that the distractors are actually incorrect per the source. The verifier is a distinct call so the model is not grading its own work.

**Failure handling.** On verifier rejection, regenerate up to N times; if still failing, discard the item and substitute one generated from a different concept/chunk so the session stays full. If the topic's chunk coverage is genuinely thin (low retrieval scores), trigger `fetchMoreMaterial`. Users never see an unverified item.

**Provenance & citations.** Each generated question/explanation persists its `sourceChunkIds`, `supportingSpans`, and verifier verdict/score wherever it is stored (`SessionItem` for sessions, the question array for `MockExam`). In-session citation chips and the `explainAnswer` tool derive from this stored provenance — citations are real references, not the model re-stating a source.

**Reading blocks & agent — grounded, not verifier-gated.** Reading blocks are composed from cited chunks (extractive grounding + citation chips); the chunk text *is* the source, so no separate verifier. The in-session agent's system prompt enforces: answer only from retrieved context, cite sources, and **abstain** ("I don't have enough material on that") rather than guess — abstention can trigger `fetchMoreMaterial`. Streaming responses cannot be pre-verified, so grounding + citation + abstention is the guarantee there.

**User report + auto-quarantine.** A "report this question" action on any quiz item or explanation immediately quarantines that generated item (evicted from cache, not reused) and surfaces it to admins with its provenance. Cheap insurance for the rare miss and a real-world quality signal.

Only verified payloads enter the question/explanation cache (see LLM Cost Optimisation); a quarantine evicts the cached entry. The verifier roughly doubles cold-generation LLM calls (generate + verify, plus occasional regenerations) but runs on the cheap utility tier and verified items are cached, so steady-state cost stays bounded.

### Model Selection Strategy

Not all LLM tasks require the same model. Models are chosen by task type to balance quality and cost:

| Task | Model type |
|---|---|
| Quiz generation, answer explanation | Utility model (fast, cheap — e.g. Haiku, GPT-4o mini) |
| Answer verification (faithfulness/entailment check) | Utility model |
| Agent Q&A responses | Mid-tier model (e.g. Sonnet, GPT-4o) |
| Certification pre-fill in admin | Mid-tier model |
| Domain tagging of content chunks | Utility model |
| On-demand material generation | Mid-tier model |
| Complex reasoning tasks | Thinking model (e.g. Claude with extended thinking, o1) |

Model IDs are configured via env vars per task type, not hardcoded.

### LLM Cost Optimisation

- **Response caching** — quiz questions and explanations are cached in Redis with a TTL, keyed on the full set of inputs that determine the output: source chunk id(s), difficulty, question format, and certification. Any user-specific input that influences generation must be part of the cache key — otherwise it must not be part of the prompt. Per-user tailoring is therefore expressed as content *selection* (which chunks/domains a user sees), not as variation in the generated text for a given chunk, which keeps the cache effective across users. Identical requests within the TTL return the cached response without an LLM call. **Only verified items are cached** (see Grounding & Verification), and a quarantine evicts the cached entry — a question that failed verification or was reported is never served from cache.
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
3. Reading blocks are composed from 1–3 related chunks, formatted by the LLM into clean readable **Markdown prose** — not raw scraped text. The frontend renders Markdown to HTML. The goal is digestible explanations, not raw documentation dumps. Each block defaults to a concise **TL;DR** (3–5 key points); a **"Go deeper"** affordance expands it into the full explanation with examples, generated on demand. The time-constrained learner gets the essentials in seconds and only expands what they don't already know.
4. For video-based content mix, session items include a **YouTube embed** deep-linked to a timestamp (`?t=<seconds>`), followed by quiz questions generated from the video's transcript chunks. The timestamp is not derived at session time — it is the transcript-segment start offset captured as chunk metadata during ingestion (see Content Pipeline). "Video-based" means *prefer video where available*, not *require video*: if a target domain has no video-sourced chunks above the similarity threshold, that item degrades silently to a normal reading block so the session is never broken or empty.
5. Quiz questions are generated by the LLM from the same chunks used in the adjacent reading block, reinforcing the material just read. Each question passes the extractive-grounding contract and verifier pass before inclusion; rejected questions are regenerated or substituted (see Grounding & Verification), so pre-generation only ever yields verified items.

### Quiz question formats

Sessions support mixed question types:
- **Multiple choice** — 4 options, one correct answer (most common)
- **True / False** — for clear-cut factual statements
- **Scenario-based** — longer stem describing a real-world situation, 4 options (used at exam-ready difficulty)

The question format is chosen by the **session planner** before generation — deterministically from the content chunk's characteristics and the session difficulty — not by the generation call itself. This keeps `format` a stable, known cache-key input (see LLM Cost Optimisation): the cache can be checked *before* any LLM call, and identical `{chunkIds, difficulty, format, certification}` requests reuse the cached verified question rather than the model picking a format mid-generation (which would make the key uncomputable up front).

### Session resume

`StudySession` tracks a `lastItemIndex` and per-item completion flags. If a user navigates away or refreshes, the session remains in `active` status. On returning to the session view, the app resumes from the last incomplete item. Sessions in `active` status older than 24 hours are automatically marked `abandoned` by a cleanup cron job.

**At most one `active` `StudySession` per `UserCertification`** (the limit spans both `study` and `review` kinds). Attempting to start a new session while one is already active surfaces and resumes the in-progress one rather than creating a second — so `lastItemIndex` is never ambiguous. Different enrollments are independent; the limit is per enrollment, not per user.

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

## Diagnostic Exam

When a user enrolls in a certification, the system offers a short **diagnostic exam** to calibrate their starting point, so the first study session is adaptive instead of generic. Without it, weak areas and readiness have no signal until several sessions accumulate — undercutting the core promise for a time-constrained learner.

- **Format** — 10–15 questions generated by the same LLM pipeline as quizzes/mocks, but the planner allocates for **breadth**: every domain is probed at least once, weighted by the domain's exam share. No pass/fail, optional/lenient timer, no agent access. Modeled as `MockExam` with `type: diagnostic` (shares scoring, domain breakdown, and review mode).
- **Optional and skippable** — offered at onboarding with a clear Skip. If skipped, the enrollment starts with a neutral baseline (no weak-area bias; readiness shown as "not yet calibrated") and the user is **re-prompted once** after the first session or two if still uncalibrated.
- **Seeding** — on completion it establishes the initial per-domain `WeakArea` map and an initial readiness value. Both enter with **low weight** and decay quickly under the existing recency weighting, so real session/mock data supersedes the 10–15-question sample fast (see Exam Readiness Score, Weak Area Tracking).
- **Availability** — only offered for **live** certifications, which already meet the per-domain content-coverage bar, guaranteeing every domain has chunks to generate from.
- **Re-taking** — re-running the diagnostic re-seeds the diagnostic contribution but does not wipe accumulated real session/mock data. Abandoning a diagnostic mid-way is treated as a skip.
- **UI** — reuses the mock-exam taking and review components (minus the strict timer/pass framing); no dedicated new screens. Entry points are the onboarding card and the later re-prompt nudge.

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

Session defaults are saved on the user profile. Per-session overrides are supported. The **spaced repetition** style is backed by the review queue — it front-loads due `ReviewItem`s before new material (see Spaced Repetition & Review Queue).

---

## Weak Area Tracking

The initial `WeakArea` map for a new enrollment is seeded by the diagnostic exam (if taken); if skipped, it starts neutral (no domain bias) until session data accumulates. After each session, review, or mock exam, `WeakArea` records are updated per domain:
- Calculated from quiz accuracy and confidence ratings combined
- Surfaced on the dashboard and used to bias session content selection
- Session planner weights content retrieval toward weak domains when style is set to weak-area focus

---

## Spaced Repetition & Review Queue

A per-`UserCertification` spaced-repetition queue maximizes retention per minute — the priority for a time-constrained learner — by resurfacing shaky knowledge at lengthening intervals instead of re-covering everything.

### Concept unit

SRS state (`ReviewItem`) attaches to a **concept**, anchored to the source `ContentChunk` a question was generated from — coarse enough to be a coherent idea, fine enough to regenerate varied questions. When an item is due, the existing quiz pipeline generates a **fresh** question from that chunk (varying format/difficulty so it is never a verbatim repeat), testing understanding rather than answer-position memory.

### What enters the queue

A concept enters when answered **incorrectly**, or **correctly with low confidence (1–2)**. Confident-correct concepts not already queued stay out, so review time is never spent on known material. Diagnostic-exam misses seed the queue, giving review signal from day one.

### Leitner schedule

Boxes with intervals **1d → 3d → 7d → 16d → 35d** (configurable):
- Correct + confident (≥ 3) → promote one box, reschedule at the new interval
- Wrong → reset to box 1
- Correct-but-unsure (1–2) → hold in the current box, reschedule at the short interval
- Promoted past the top box → concept becomes `mastered` and exits the queue

### Consumption (both paths)

1. **Standalone "5-minute review"** — a quiz-only `review`-kind `StudySession` pulling only *due* items (capped ~5–7 questions, no reading blocks). When nothing is due, an "all caught up" empty state offers a normal session instead.
2. **Woven into sessions** — the "spaced repetition" learning style (Session Personalization) is backed by this queue: it front-loads due items at the start of a normal session before new material.

### Interactions

- Review answers are ordinary `QuizResponse`s, so they feed weak areas and the readiness score like any quiz — doing reviews visibly moves the readiness number.
- **Mark-as-mastered:** a user can manually retire a concept (or domain) they know cold; this sets `state: suppressed`, removing it from both the review queue and new-material selection so the planner stops spending their time on it.
- Cold start: the queue is empty until the user answers quizzes or takes the diagnostic; the empty state handles this.

---

## Exam Readiness Score

A single percentage (0–100%) shown prominently on the dashboard and progress page, representing how prepared the user is for their target certification exam.

Computed from:
- Per-domain weak area scores, weighted by the domain's share of the real exam (e.g. AWS CCP: Cloud Concepts 26%, Security 25%, etc.)
- Mock exam scores factored in with higher weight than regular session quiz scores
- A diagnostic exam (if taken) seeds the **initial** value but enters with **low weight** and decays quickly under recency weighting — real sessions and mocks supersede it fast
- Recency-weighted so recent improvement is reflected quickly

If no diagnostic was taken and no sessions/mocks exist yet, readiness is shown as **not yet calibrated** rather than a misleading number. It flips from "not yet calibrated" to a real percentage as soon as there is enough signal to be honest: a completed diagnostic, **or** at least **N graded quiz answers** (default 10, configurable) accumulated across any combination of sessions, reviews, and mocks. Below that bar the dashboard keeps showing "not yet calibrated". The score updates after every session, review, and mock exam (including the diagnostic).

### Readiness trajectory (passive, opt-in)

A purely informational projection on the Progress page: from the user's recent rate of readiness gain, an estimate such as *"at your recent pace, exam-ready in ~N weeks."* No exam date is entered and **no reminders are sent** — the app deliberately avoids deadline pressure and is meant to be visited whenever the user has time. The projection is gentle encouragement, not an obligation, and is hidden until there is enough history to estimate a trend. The exact formula is left flexible for tuning during implementation — the intent is a number that moves meaningfully with effort and honestly reflects readiness.

---

## End-of-Session Summary

After every study session or mock exam, the user sees a summary screen before returning to the dashboard:

- Questions answered and accuracy for that session
- Domains covered, with per-domain accuracy
- Weak area score deltas ("Security +4%, Billing −1%")
- Exam readiness score change ("72% → 75% ready")
- Strongest and weakest question of the session, with the option to ask the agent about either
- A suggested focus for the next session based on updated weak areas
- A one-tap **"Drill my misses"** action that immediately starts a short targeted session generated from the concepts missed or flagged-unsure in this attempt (these concepts also enter the review queue automatically; the drill is the *don't-wait-for-the-interval* option)

---

## Certification Setup & Grounding

Exam-format facts (question count, passing score, time limit, domain list and weights) must be trustworthy — they drive the readiness score, mock-exam format, and agent context — yet the admin setting up a cert is often a learner who cannot validate them from memory. So cert metadata is grounded, not blindly accepted.

**Primary-target certs — verified seed data.** The certifications listed under Supported Certifications ship as human-verified seed data, curated once against their official exam guides. They do not depend on LLM pre-fill at all. This gives the certs most users will study the highest trust.

**New / unlisted certs — grounded pre-fill.** A bare cert code does not by itself tell the app where to fetch, so the source is discovered and **confirmed by the admin** before anything is extracted:
1. Admin enters a cert name or code.
2. **Source discovery** — the setup agent uses a web-search tool to locate the official exam guide, prioritizing the vendor's own domain, and proposes candidate source URL(s). (The LLM never invents a URL and grounds against whatever it fetches — discovery is an explicit search step.)
3. **Admin confirms the source** — the admin confirms which proposed link is the genuine official guide, or pastes the correct URL if discovery missed it. Confirming *the source* is a check a learner can make (recognizing the official vendor domain) even when they cannot validate the *facts* from memory — so the human gate sits where the admin actually has competence.
4. **Extraction** — the agent fetches the confirmed source via the scrapper and extracts each format field **with a citation to the exact source passage**.
5. The admin reviews each field *next to its cited source* and confirms.
6. Any field that could not be grounded to the confirmed source is flagged **"unverified — confirm manually"** so gaps are visible rather than silently invented.

This preserves the "add any cert without code changes" property while making accept/reject a meaningful, source-checkable action rather than a rubber stamp. Suggested content sources from the pre-fill are likewise presented for admin review before ingestion.

**Metadata freshness.** Each certification's exam-format fields carry a `verifiedAt` date (and, for grounded pre-fill, the source URL they were extracted from). Vendors revise exams over time, so a configurable staleness interval flags a cert's metadata as **"due for re-verification"** in the admin once `verifiedAt` ages past it — surfacing it for a human re-check rather than silently trusting stale weights and formats. Re-verification reruns the same source-confirmation + per-field-citation flow.

**Draft → live is automatic.** A cert leaves `draft` and becomes enrollable on its own once the coverage bar is met (per-domain chunk minimums, total-chunk multiple, ≥1 ingested source per domain — see PRD §4); there is no manual "publish" button. The admin UI shows per-domain coverage so the gap to go-live is visible, but crossing the bar flips the cert to `live` without an extra step.

---

## Supported Certifications

Certifications are data-driven and added via the admin interface without code changes. The domain list and domain weights (used for the readiness score) are configured per certification. The certs below ship as **verified seed data** (see Certification Setup & Grounding).

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
