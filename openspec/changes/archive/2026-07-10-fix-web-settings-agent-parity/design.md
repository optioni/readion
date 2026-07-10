## Context

19 findings across the Study-defaults settings tab and the standalone Agent chat. This change reconciles the settings findings against the authoritative `packages/shared` session-default enums and the `web-settings` spec — several artboard details would silently change real option sets.

## Reconciliation decisions

| Finding (severity) | Screen | Decision | Rationale |
|---|---|---|---|
| Raw enum slugs shown as labels (high ×3: difficulty, content mix, learning style) | Settings | **Fix (label map)** | Render human-readable labels via a value→label map; the enum sets stay authoritative. |
| Design's reduced/renamed option sets (learning style 2 vs 3; "Easy/Medium/Hard") | Settings | **Reaffirm enums** | The `packages/shared` enum sets are authoritative — map to labels, do NOT drop or rename values to match a simplified artboard. |
| Session-length slider ticks 5/15/30/45/60 | Settings | **Fix slider, real values** | Use a slider, but snap to the real `sessionDefaultDurations = [15,30,60,90]`, not the design's arbitrary ticks. |
| Extra "Focus area" field (design omits it) | Settings | **Reaffirm** | `web-settings` specs "all five session defaults" incl. focus area; the artboard is incomplete. |
| FieldRow layout, section title, intro copy, hint, pill shape (medium/low) | Settings | Fix | Fidelity. |
| Full-height chat shell / default padded layout (high) | Agent | Fix | Opt into the minimal/full-height layout like the session runner + mock exam. |
| Bubble colors swapped (high) | Agent | Fix | The app inverts the design + manifest roles (user = surface/secondary, assistant = primary/white). |
| Per-message avatar, inline white cursor, paragraph rendering, conditional send, TTL/new-chat icons, placeholder ellipsis (medium/low) | Agent | Fix | Fidelity. |

## Net scope

Presentational fixes plus one layout opt-in (agent minimal layout) and one storage-adjacent tweak (splitting the stored assistant turn into paragraphs for rendering — no change to how turns are persisted). The authoritative enums and the five-field settings contract are preserved; the fixes are label/presentation only.

## Follow-ups (not this change)

- If product wants to genuinely reduce the learning-style options to two or rename difficulty to Easy/Medium/Hard, that is an enum + backend change, not a label map — its own change.
