## Why

The Phase-13 frontend change `web-quarantine-reviewer-detail` needs to render each quarantined item's **question, options, and answer key** in a master-detail reviewer (per `openspec/design/AdminContentUsers.html`). It is **blocked**: `GET /api/v1/admin/quarantine` returns only the verdict/reason/provenance, and the generated question/options live **unmapped** in the `quarantined_items.generatedContent` JSONB column with no detail endpoint. This backend change exposes that content so the reviewer can be built. (Surfaced when `web-quarantine-reviewer-detail` hit the "no backend scope" guard during the Phase-13 run.)

## What Changes

- Add an admin, read-only **`GET /api/v1/admin/quarantine/:id`** that returns the full quarantined item: verdict/reason/provenance/status **plus a typed mapping of `generatedContent`** (question stem, options, answer key, and any per-option metadata needed to render the item).
- Map the `generatedContent` JSONB to a **typed shape** in `@readion/shared` (don't leak raw JSONB); narrow the read in the service.
- Keep the existing list endpoint **lean** (no `generatedContent` in the list); the detail endpoint serves the heavy fields.
- `RolesGuard`/admin-only; read-only (no audit entry — audit stays on approve/reject).
- Regenerate the Orval client (`yarn codegen`) and commit it.

## Capabilities

### Modified Capabilities
- `content-quarantine-review`: adds an admin quarantined-item **detail read** exposing the typed `generatedContent` (question/options/answer key) alongside verdict/provenance.

## Impact

- **Code**: `apps/api/src/admin/` (quarantine-admin controller route + service detail method + JSONB→typed mapping), `packages/shared` (item-detail response schema/types), Orval client regen. NestJS integration tests (Supertest + Testcontainers) for the detail endpoint (admin-only, shape incl. mapped content, 404 for unknown id); unit test for the mapping.
- **No new entity/migration** — reads the existing `quarantined_items` row (owned by `quarantine-review-queue`).
- **API**: new `GET /api/v1/admin/quarantine/:id` → run `yarn codegen` and commit the regenerated client.
- **Dependencies**: archived `quarantine-review-queue`, `admin`. **Unblocks `web-quarantine-reviewer-detail`**, which should be ff'd/implemented immediately after this.
