---
description: Fast-forward an OpenSpec change from IMPLEMENTATION-ORDER.md into full artifacts
argument-hint: <change-name>
---

You are an OpenSpec change author for this repository. The change to author is `$ARGUMENTS` — a single change from openspec/IMPLEMENTATION-ORDER.md (e.g. "shared-contracts"). Your job is to gather everything that change needs from the roadmap and the source-of-truth specs, then fast-forward it into a complete set of OpenSpec artifacts ready for implementation.

Treat openspec/IMPLEMENTATION-ORDER.md as an INDEX, not the requirements. The Scope column is a one-line reminder only — the real requirements and acceptance scenarios live in the linked Spec refs in SPEC.md and PRD.md. Always open those.

Do the following in order, then stop and report before generating if anything is inconsistent:

1. Locate the change's row in the Phases tables of openspec/IMPLEMENTATION-ORDER.md. Extract its Scope, Spec refs, Capabilities (the pre-named kebab-case spec names), and Depends on.
2. Open SPEC.md (and PRD.md where a ref is prefixed "PRD") and read every linked Spec ref in full. These are the actual requirements and acceptance scenarios the change must satisfy. Quote/summarize the concrete requirements you find — do not work from the Scope reminder alone.
3. Check the "Entity ownership" table for any entity this change OWNS (it must create the table + migration) versus entities it only extends. Note these so the change's tasks and delta specs reflect the correct migration boundaries. Never claim an entity another change owns.
4. Check the "Cross-cutting deliverables" section for anything attributed to this change — worker-side crons and feature-emitted metrics — and fold those into scope so they aren't dropped.
5. Verify the change's dependencies (Depends on, plus edges in the Mermaid dependency graph) already exist as archived/created changes under openspec/changes/. If a hard dependency is missing, flag it and ask whether to proceed anyway.
6. Read CLAUDE.md and follow its conventions in the artifacts — especially outside-in TDD test ordering, the API response/error envelope, absolute-path imports, TypeScript strict mode, and the monorepo workspace layout.

Then invoke the openspec fast-forward workflow (the opsx:ff skill) to generate all artifacts (proposal, design, tasks, and delta specs) for this change. Constraints:
- Use exactly the capability names from the roadmap's Capabilities column for the delta spec directories (specs/<capability>/spec.md). If reading the Spec refs convinces you the pre-named capabilities are wrong, stop and flag it so the roadmap gets updated first — don't silently rename, invent, or merge.
- The proposal and tasks must reflect the requirements you read in SPEC.md/PRD.md, the owned entities and their migrations, and the cross-cutting crons/metrics — not just the one-line Scope.
- Keep the change contained to this one roadmap row; do not pull in scope that belongs to a downstream change.

When done, give me a short summary: which Spec refs you read, the capabilities created, entities owned, any cross-cutting deliverables included, and any dependency or consistency issues you flagged.
