## Context

The `content-quarantine-review` capability already persists quarantined items (`quarantine-review-queue`) and exposes admin list/approve/reject (`QuarantineAdminController` + `QuarantineAdminService`). The frontend `web-quarantine-reviewer-detail` reviewer needs each item's **question, options, and answer key**, but those live unmapped in the `quarantined_items.generatedContent` JSONB column and there is no detail endpoint — the list deliberately stays lean (verdict/reason/provenance only). This change adds the read-only detail endpoint and a typed JSONB → detail mapping, reusing the existing admin module conventions.

This is a backend change in `apps/api/src/admin/` + `packages/shared`. It adds one route, one service method, one pure mapping helper, the shared response type(s), and the controller DTO; it ends with `yarn codegen`. No entity, migration, cache, or audit work — the read touches the existing row and writes nothing.

## Goals / Non-Goals

**Goals:**
- Add admin-only `GET /api/v1/admin/quarantine/:id` returning the item's verdict/reason/provenance/status/certification/domain/createdAt **plus** a typed mapping of `generatedContent` (question, options, answer key, format, supporting spans, source-chunk ids).
- Map the JSONB to a typed `@readion/shared` shape; never leak raw JSONB to the client.
- Keep the list endpoint lean (no `generatedContent`).
- Tolerate `null`/malformed `generatedContent` by representing the content as absent (`null`), never throwing.

**Non-Goals:**
- No new entity, migration, cache write, or audit entry (read-only; auditing stays on approve/reject).
- No editing of the quarantined content (out of scope; resolution stays approve/reject).
- No change to list/approve/reject behaviour.

## Decisions

### New route on the existing controller

Add `@Get('quarantine/:id')` to `QuarantineAdminController`, which is already `@Roles('admin')` at the class level — so the route inherits the admin guard (`RolesGuard`) and the global auth (anon → `401`, non-admin → `403`) with no extra wiring. The handler returns a single-resource envelope `{ data }` (matching the existing `approve`/`reject` handlers; the global `ResponseInterceptor` does not double-wrap an already-`data`-keyed object — same pattern as the resolution handlers).

```typescript
@Get('quarantine/:id')
@ApiResponse({ status: 200, type: QuarantinedItemDetailResponseDto })
@ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
@ApiResponse({ status: 404, description: 'Quarantined item not found' })
async detail(@Param('id') id: string) {
  return { data: await this.service.getDetail(id) }
}
```

### Service `getDetail(id)` + a pure mapping helper

Add `getDetail(id: string): Promise<QuarantinedItemDetail>` to `QuarantineAdminService`. It forks the EM, `findOne(QuarantinedItem, { id })`, throws `NotFoundException('Quarantined item not found')` when missing (→ global `ExceptionFilter` → `404` RFC 7807, matching `resolve`), and maps the row to the shared detail type. It reuses the same list-item field projection (`id`, `certificationId`, `domain`, `verdict`, `reason`, `status`, `provenance`, `createdAt`) and adds the mapped `content`.

The JSONB → `content` mapping is a **pure, exported helper** (e.g. `mapGeneratedContent(generatedContent: Record<string, unknown> | null): QuarantinedItemDetailContent | null`) so it is unit-testable in isolation (tasks 2.1/2.2). The quarantine write stores `generatedContent = { item, format }` (see `quiz.service.ts#reportQuestion`), where `item` is an `ExtractiveItem` (`{ question, options, correctAnswer, supportingSpans, sourceChunkIds }`) and `format` is a `QuestionFormat`. The helper narrows defensively:

- `generatedContent === null` → return `null`.
- Missing/non-object `item`, or a `question` that is not a non-empty string → return `null` (the content is treated as absent).
- Otherwise map: `question` ← `item.question`; `options` ← `item.options` (coerced to a `string[]`, defaulting to `[]` for non-quiz/`explanation`-style rows); `answerKey` ← `item.correctAnswer`; `format` ← `format` when it is a valid `QuestionFormat`, else `null`; `supportingSpans` / `sourceChunkIds` ← the item's arrays (defaulting to `[]`).

The list query is unchanged and continues to omit `generatedContent`.

### Null-tolerance as an explicit design choice

`generatedContent` is `Record<string, unknown> | null` on the entity, written from a cache payload that is not schema-guaranteed and is shared across domains (quiz items today; non-quiz domains such as `explanation` carry no options). Older rows may predate the `{ item, format }` shape. Rather than 500 on these, the mapping **represents absent/malformed content as `content: null`** while still returning the verdict/provenance/status. This keeps the detail endpoint robust for every historical row and lets the reviewer render a graceful "no structured content" state. This is the explicit trade-off: the API never asserts the JSONB conforms; it narrows and degrades to `null`.

### Shared type(s)

Add to `packages/shared/src/admin/index.ts`, reusing the existing `QuarantinedItemListItem`:

```typescript
export interface QuarantinedItemDetailContent {
  question: string
  options: string[]
  answerKey: string
  format: QuestionFormat | null
  supportingSpans: string[]
  sourceChunkIds: string[]
}

export interface QuarantinedItemDetail extends QuarantinedItemListItem {
  content: QuarantinedItemDetailContent | null
}
```

`QuarantinedItemDetail` extends the list item so the shared overlap (verdict/provenance/status/etc.) has a single source of truth (task 1.3), adding only the nullable typed `content`. `QuestionFormat` is imported from `@readion/shared` `quiz`. If a runtime guard is wanted to back the mapping helper, a matching Zod schema may be co-located, but the contract surface is the TS interface above.

### Controller DTO for Swagger/Orval

Add a `QuarantinedItemDetailContentDto` (`question`, `options: [String]`, `answerKey`, `format` enum nullable via `questionFormats`, `supportingSpans: [String]`, `sourceChunkIds: [String]`) and a `QuarantinedItemDetailDto` (extends/duplicates the list-item DTO fields + `content: QuarantinedItemDetailContentDto | null`), wrapped in `QuarantinedItemDetailResponseDto { data }`. These exist solely so `@nestjs/swagger` emits the `/api-json` schema Orval consumes; the runtime contract is the `@readion/shared` type. `content` nullability is annotated with `@ApiProperty({ nullable: true })`.

### Codegen

After the route lands and `apps/api` is running, run `yarn codegen` and commit the regenerated Orval client under `apps/web/src/api/` so `web-quarantine-reviewer-detail` can consume the new detail operation. CI does not regenerate.

## Test Boundaries

Outside-in TDD per the repo convention:

| Layer | Test | Dependencies |
|---|---|---|
| Acceptance (integration) | Supertest + `@nestjs/testing` + Testcontainers: admin reads detail (verdict/provenance + mapped question/options/answer-key), non-admin → `403`, anon → `401`, unknown id → `404`, null/malformed `generatedContent` → `200` with `content: null` and no `500` | real Postgres/Redis (Testcontainers), real NestJS app |
| Unit | `mapGeneratedContent` pure helper: `{ item, format }` → typed content; `null` → `null`; malformed/non-quiz → `null` or `options: []` | none (pure) |

The read writes no `AuditLog`, asserted in the integration test (read-only invariant).

## Risks / Trade-offs

- **Unschematized JSONB** → mitigated by the defensive pure mapping that degrades to `content: null` rather than throwing; covered by unit tests for null/malformed/non-quiz inputs.
- **DTO/shared-type drift** → the `@readion/shared` interface is the source of truth and is reused by the service return type; the DTO exists only for Swagger/Orval emission and is kept field-aligned.

## Open Questions

- None blocking. Unblocks `web-quarantine-reviewer-detail`, to be ff'd/implemented immediately after.
