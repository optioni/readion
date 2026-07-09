---
description: Diff design artboards against their app implementation and report the parity gaps (one screen or all)
---

Run the design/implementation parity diff.

Argument (`$ARGUMENTS`): optional. Empty or `all` = every screen in the manifest. Otherwise treat it as a screen `id`, `screen` name, or `route` substring and diff only the matching artboard(s).

Steps:

1. Read `openspec/design/manifest.json`. Each entry has `{ id, screen, route, state, file }`.
   - If it does not exist yet, tell the user the manifest hasn't been produced by Claude Design yet and stop — the diff needs it as the work-list.
2. Build the artboard list: all entries, or only those matching `$ARGUMENTS` (case-insensitive match against `id`, `screen`, or `route`). If a filter matches nothing, say so and list the available screens.
   - Always exclude artboards with `route: null` (App Shell / Readiness component references — no screen to diff).
   - Default scope for a full run is one representative artboard per screen (prefer the `populated`/`default` state); only fan every drawn state when the user asks for it.
3. Call the `Workflow` tool with `scriptPath: "<repo>/.claude/workflows/parity-diff.js"` (use the absolute path; invoking by `name` can resolve to a stale in-session snapshot) and `args: { artboards: <the selected entries> }`.
   - This fans one read-only `parity-differ` agent per screen/state; it needs no code changes and edits nothing.
4. When it returns, PERSIST per view (workflow scripts can't write files — you do it here). Reports live in `openspec/design/parity/`:
   - For each screen in the result, write `openspec/design/parity/<screen-id>.json` (raw findings for that view — the machine-readable source of truth the fix step consumes) and `openspec/design/parity/<screen-id>.md` (readable: summary line, then findings most-severe first as `[severity] element — class/axis — design vs app (evidence)`). Use the manifest `screens[].id` as `<screen-id>`, grouping any diffed states of that screen into its one file.
   - A single-screen run touches only that view's two files; a full run rewrites the set. Git keeps history.
   - Regenerate `openspec/design/parity/INDEX.md` from ALL per-view `*.json` present (not just this run's): total counts; a per-screen table (screen · high/med/low · link to its `.md`); and a "recurring across screens" section listing element/gap names that appear on 2+ screens — these point to shared-component fixes, not N separate ones.
5. Present the summary to the user and point them at `openspec/design/parity/INDEX.md`.
   - Do not fix anything. This command only reports the gap list; fixing is a separate, deliberate step.

Single-screen sanity check before a full run: `/parity-diff <one screen>` is the cheap way to confirm the pipeline before fanning across all ~22 screens.
