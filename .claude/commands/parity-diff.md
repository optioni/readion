---
description: Diff design artboards against their app implementation and report the parity gaps (one screen or all)
---

Run the design/implementation parity diff.

Argument (`$ARGUMENTS`): optional. Empty or `all` = every screen in the manifest. Otherwise treat it as a screen `id`, `screen` name, or `route` substring and diff only the matching artboard(s).

Steps:

1. Read `openspec/design/manifest.json`. Each entry has `{ id, screen, route, state, file }`.
   - If it does not exist yet, tell the user the manifest hasn't been produced by Claude Design yet and stop — the diff needs it as the work-list.
2. Build the artboard list: all entries, or only those matching `$ARGUMENTS` (case-insensitive match against `id`, `screen`, or `route`). If a filter matches nothing, say so and list the available screens.
3. Call the `Workflow` tool with `name: "parity-diff"` and `args: { artboards: <the selected entries> }`.
   - This fans one read-only `parity-differ` agent per screen/state; it needs no code changes and edits nothing.
4. When it returns, present the results to the user:
   - A one-line summary: N findings across M screens (high/medium/low counts).
   - Then the findings grouped by screen, most-severe first, each as: `[severity] element — class/axis — design vs app (evidence)`.
   - Do not fix anything. This command only reports the gap list; fixing is a separate, deliberate step.

Single-screen sanity check before a full run: `/parity-diff <one screen>` is the cheap way to confirm the pipeline before fanning across all ~22 screens.
