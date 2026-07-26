## Reviewed Artifacts

- proposal.md
- specs/ci-pipeline/spec.md
- design.md
- tasks.md
- Existing baseline read for comparison: `openspec/specs/ci-pipeline/spec.md`, `.github/workflows/main.yml`, `.github/workflows/release.yml`, `docker-bake.hcl`, root `Dockerfile`, `package.json`, `vitest.config.ts`, `tests/`, `k8s/argocd/application.yaml`, and the sibling `tv-guide/katsain` `.github/workflows/images.yml` this change ports from.

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | proposal.md → Impact | Claimed "no Kubernetes or ArgoCD manifest is touched", contradicting tasks.md 5.2, which edits comments in `k8s/argocd/application.yaml` that name the deleted `main.yml`. | Narrowed the claim to manifest *values*, and stated the comment-only edit explicitly while keeping the `allow-tags` regexp out of scope. | proposal.md → Impact (Deployment) |
| WARNING | proposal.md → Modified Capabilities | Listed three requirement changes, but the spec delta contains six (four ADDED, one MODIFIED, one REMOVED). Release-after-build, affected-app builds, source-map scoping, and the replacement Single-Dockerfile requirement existed only in the spec. | Enumerated all six requirement changes with their delta operation. | proposal.md → Capabilities |
| WARNING | tasks.md → group 0 | Four spec scenarios had no acceptance-test work: the two diff-base fail-safes and both empty-set behaviors live in `detect`'s bash, which nothing asserted. Under-building is the change's stated dangerous failure mode, so an untested fail-safe is a real gap. | Added task 0.4 asserting the resolved `detect` step body — per-trigger base branches, all-zero-sha guard, both fallbacks — plus the `build-and-push` empty-set skip. | tasks.md → 0.4 (group renumbered) |
| WARNING | tasks.md → group 0 | The three "Source maps scoped to the published release" scenarios had implementation work (4.1) but no assertions. | Added task 0.5 asserting per-trigger `RELEASE`, per-app gating on the affected set, and the retained `SENTRY_AUTH_TOKEN` gate. | tasks.md → 0.5 |
| WARNING | tasks.md → group 0 | The added "Single-Dockerfile image build" requirement's first scenario (root `Dockerfile` stages, one bake target per app) had no test; only the `--print` sanity check in 3.5 touched bake. | Added task 0.6 asserting the `Dockerfile` final stages and the `docker-bake.hcl` targets. | tasks.md → 0.6 |
| WARNING | design.md → Test Boundaries | The table did not name the collaborators tasks.md relies on: the `yaml` parser, the `Dockerfile`/bake structural assertions, the statically-asserted Sentry gating expressions, and `actionlint`. Tasks would otherwise be inventing boundaries the design never declared. | Added rows for each, and split the GHCR/Sentry/Releases row into statically-asserted expressions vs. live-only effects. | design.md → Test Boundaries |
| WARNING | design.md → Decisions | The fail-safe was described as one mechanism, while tasks.md splits it: malformed JSON handled inside the script (unit-testable), unresolvable base and non-zero turbo exit handled in bash. Ambiguous ownership would have left one path untested. | Made the two owners explicit in the fail-safe decision. | design.md → Decisions |
| WARNING | specs + design | The three CalVer-derivation scenarios (`.0`, MICRO increment, pre-existing `v0.9.*` tags ignored) are behaviors of a third-party action that no local test can execute, so they read as acceptance tests with no possible runner. | Named the boundary in design.md (only the action's inputs are asserted) and added an explicit post-merge live-dispatch verification task rather than letting the scenarios imply local coverage. | design.md → Test Boundaries; tasks.md → 6.4 |
| SUGGESTION | proposal.md → Impact | `yaml` (needed by the workflow-contract test) and the new test/script files were absent from the impact list, which named only `turbo`. | Added the `yaml` devDependency and a Tests line covering both spec files and `.github/scripts/affected-apps.ts`. | proposal.md → Impact |

Verified and found correct, no change needed: the MODIFIED and REMOVED requirement headers match `openspec/specs/ci-pipeline/spec.md` exactly (`Main-branch image build and tag`, `Per-app Dockerfiles`); the MODIFIED requirement carries its full body plus both original scenarios; the repository genuinely has no `apps/*/Dockerfile`, so the REMOVED requirement's stated reason holds; every scenario uses four-hashtag headers; task groups run outermost-first (contract test → pure mapping logic → turbo config → workflow → ripple), and none are marked parallel, correctly, since groups 3–5 all touch one workflow file or its immediate references.

## No Remaining Implementation-Blocking Gaps

All gaps above were repaired in the artifact that owns them. Every spec scenario now has either an assertion task in tasks.md or an explicitly recorded live-verification step whose boundary design.md declares. No requirement, decision, or test boundary exists in only one artifact.

## Deferred Non-Blocking Notes

- The `k8s/argocd/application.yaml` `allow-tags` regexp (`^(latest|sha-.+)$`) matches neither the `main` tag pushed today nor the new `v*` tags, so ArgoCD Image Updater currently matches nothing. Deferred deliberately: correcting it changes what rolls to the cluster, and it is entangled with the separate question of whether production should pin `v*` instead of tracking `main`. Recorded in proposal.md → Impact and design.md → Non-Goals / Open Questions; tasks.md 5.2 changes only that file's comments.
- GitHub Action major-version bumps (this repo is on `checkout@v4`/`bake-action@v6` while katsain is on newer majors) are left to Renovate, per design.md → Non-Goals.
- Extracting `pr.yml`'s five duplicated toolchain preambles into a composite action is out of scope; `detect` inlines the preamble instead, per design.md → Decisions.
