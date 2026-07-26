## Context

Two workflows publish images today. `main.yml` (push → `main`) builds all three images via one `docker/bake-action` invocation against the root `Dockerfile`, tags them with the branch name, and uploads Sentry source maps keyed to `github.sha`. `release.yml` (`workflow_dispatch` with a required `version` input) normalizes the input to `v<x>`, pushes the git tag, cuts the GitHub Release, *then* builds the same three images at that tag and uploads source maps keyed to the tag. The build half is duplicated between the two, the release half is ordered so that a build failure leaves a tag and a Release with no images behind it, and neither trigger looks at what actually changed.

The sibling project tv-guide/katsain runs the target shape in a single `images.yml`: a `version` job derives CalVer from the release date, a `detect` job asks Turborepo which apps the change range affects, the build consumes that set, and a dispatch-only `release` job cuts the tag at the end. This change ports that shape onto Readion's differences: bake-with-one-root-Dockerfile instead of three per-app Dockerfiles, no Turbo in the repo yet, and a self-hosted arm runner group reserved for image builds.

Constraints:
- `arm-runners` is a self-hosted group that exists solely so arm64 images build natively (no QEMU). Nothing that isn't a docker build belongs on it.
- Bake's value here is that `base`/`deps`/`packages-build` compile once and are shared by the `api`/`worker`/`web` targets. Any affected-app filtering must preserve that.
- Under-building is the dangerous failure: a missing image means GitOps keeps running a stale one. Over-building only costs minutes.
- `SENTRY_AUTH_TOKEN` is optional; every source-map step is already individually gated on it and must stay that way.

## Goals / Non-Goals

**Goals:**
- One workflow, two triggers, no duplicated build/Sentry logic.
- A release version nobody types: CalVer `vYYYY.M.MICRO` derived from the release date, computed once and shared by every downstream job.
- Nothing published when the build fails — no tag, no Release, no partial image set.
- Build only the apps affected by the change range, derived from the real workspace dependency graph, with an explicit fail-safe to all apps.

**Non-Goals:**
- No change to deployment. GitOps still tracks the `main`-tagged images; `k8s/` is untouched. The pre-existing `k8s/argocd/application.yaml` `allow-tags: regexp:^(latest|sha-.+)$` mismatch (it matches neither the `main` tag pushed today nor the new `v*` tags) is *not* fixed here, and no Image Updater strategy is introduced for `v*`.
- No GitHub Action major-version bumps; Renovate owns those.
- No extraction of `pr.yml`'s five duplicated toolchain preambles into a composite action.
- Turbo does not become the task runner. `yarn build` / `test` / `typecheck` keep using `yarn workspaces foreach`.
- Existing `v0.9.x` tags are neither rewritten nor deleted.

Not a UI or email change — no Claude Design artboards apply, so there is no Visual Design section.

## Test Boundaries

The deliverable is CI configuration; there is no runtime surface, so the outermost executable test is a contract assertion over the workflow YAML rather than a Playwright e2e. Root-level `tests/` already holds exactly this kind of config test (`tests/orval.config.spec.ts` asserts `orval.config.ts`; `tests/workspace.smoke.test.ts` shells out to `yarn workspaces list`), so both new test files live there under the existing `root-smoke` Vitest project.

The one piece of real logic — mapping `turbo ls --affected` output to bake target names — is extracted out of the workflow into `.github/scripts/affected-apps.ts` so it can be unit tested directly instead of only being exercised by a live workflow run.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| GitHub Actions runner/expression engine | not simulated — `images.yml` is parsed with the `yaml` package (a new root devDependency, so the assertions are structural rather than string greps) and asserted on triggers, absence of inputs, job graph and `needs` edges, `runs-on`, permissions, concurrency, CalVer `format`, and `fetch-depth: 0` | n/a |
| Turbo CLI (`turbo ls --affected`) | not invoked; the workflow's invocation is asserted statically | not invoked — the mapping module is fed captured `turbo ls --output=json` payloads as fixtures |
| Node type-stripping of the `.ts` script | real — the acceptance test executes `node .github/scripts/affected-apps.ts` with fixture stdin under the repo's Node, proving the runner can run it unflagged | real (Vitest imports the module directly) |
| git history / diff-base resolution (`git describe`, `github.event.before`) | not executed — the resolved `detect` step body is asserted as text, including the all-zero-sha guard, the per-trigger base branches, and the empty-set-on-dispatch fallback | n/a |
| `docker buildx bake` | not executed in Vitest; `docker buildx bake --print` for a full and a restricted target set is a manual verification step during implementation | n/a |
| Root `Dockerfile` / `docker-bake.hcl` structure | asserted statically — final stages `api`/`worker`/`web` exist and bake declares one target per app referencing the root `Dockerfile` | n/a |
| `alepee/calendar-version-action` MICRO counter | not invoked — only its inputs (`dateFormat`, `format`) and `fetch-depth: 0` are asserted; the derived-version scenarios are proven by the first post-merge dispatch, which is an explicit verification task | n/a |
| GHCR push, Sentry API, GitHub Releases API | never invoked from tests — dispatch-only side effects; the Sentry/release gating **expressions** are asserted statically, the effects themselves by the first real dispatch | n/a |
| `actionlint` | optional local sanity check on the finished workflow; not a CI gate (this repo does not install it) | n/a |

Coverage note: the ≥80% gate applies to the extracted script, which the unit tests cover including every fail-safe branch. Workflow YAML is not instrumentable and contributes no coverage either way.

## Decisions

**One `images.yml` replacing both workflows, rather than keeping `release.yml` and only swapping its version source.** The duplicated build+Sentry blocks are the reason the two drifted (`release.yml` still checks out `ref: <tag>`, `main.yml` still carries a slash-sanitizing tag step for branches it can never see). Merging removes the duplication and puts both tag schemes in one place. Alternative — CalVer inside the existing `release.yml` — was the smaller diff but preserves the duplication and the tag-before-build ordering bug.

**`version` and `detect` run on `ubuntu-latest`, not `arm-runners` (deviation from katsain).** The self-hosted group exists for native arm64 docker builds; a git-describe and a `turbo ls` do not need it and would occupy a scarce runner slot. Only `build-and-push` stays on `arm-runners`.

**`version` runs on both triggers even though push ignores its output.** A skipped job makes every job that `needs:` it skip too, which would silently disable the build on push. Running it unconditionally and ignoring the value on push is what katsain does and is cheaper than sprinkling `if: always()` across the graph.

**Affected apps feed bake's `targets` input; no job matrix (deviation from katsain).** Katsain matrixes over apps because each app has its own Dockerfile. Here a matrix would run one bake per app and recompile the shared `base`/`deps`/`packages-build` stages per leg — more expensive than just building all three today. Filtering `targets` inside a single invocation keeps the sharing and still skips the per-app final stages. `detect` therefore emits one JSON array (`apps`) and the build passes `targets: ${{ join(fromJSON(needs.detect.outputs.apps), ',') }}`, while the source-map job uses `contains(fromJSON(...), 'api')` for exact matching rather than substring matching on a CSV string.

**Turbo is added purely as a graph-query tool.** `turbo ls --affected` reads the real workspace dependency graph, so a `packages/shared` change correctly fans out to api, worker and web with no hand-maintained path rules to drift. Alternatives considered: hand-rolled path-prefix rules (no new dependency, but the rules silently rot when the layout changes — and the failure mode is under-building) and computing the reverse dependency graph from `yarn workspaces list --json` ourselves (same semantics as Turbo, but bespoke code to maintain for no gain). Katsain already pairs `turbo` in devDependencies with `yarn workspaces foreach` as the runner, so this matches the sibling repo. `turbo.json` declares a single `build` task plus `globalDependencies: ['.nvmrc', 'tsconfig.base.json', 'Dockerfile', 'docker-bake.hcl']`, so a change to any image-affecting root file marks every app affected.

**The affected-set mapping lives in `.github/scripts/affected-apps.ts`, not in a workflow heredoc.** Katsain inlines this as a `node -e` script inside bash. Inline, the one branch that can silently ship a stale image is untestable. Extracted, it is a pure function over `turbo ls` JSON with unit tests for each fail-safe path. It is `.ts` (not `.mjs`) to hold the repo's TypeScript-strict convention; Node 24 strips types natively, so the workflow runs `node .github/scripts/affected-apps.ts` with no flag and no build step, and the acceptance test executes it the same way to prove that.

**Fail safe to all three targets, always — split across two owners.** The extracted script owns the *data* fail-safe: unparseable JSON, a missing `packages` key, or a non-array `items` all make `selectImageTargets` return `['api','worker','web']`, so that path is covered by unit tests rather than only by a live run. The workflow bash owns the *environment* fail-safe: unresolvable diff base (no prior `v*` tag, all-zero `github.event.before` from a first/force push) and a non-zero `turbo` exit short-circuit to all three before the script is ever reached. Concretely: unresolvable diff base, a non-zero `turbo` exit, or unparseable/empty script output all resolve to `api,worker,web`. An empty affected set on `workflow_dispatch` also builds all three: a manual dispatch is an explicit intent to publish a release, never a no-op. An empty set on push legitimately builds nothing, and `build-and-push` is skipped by `if`.

**Release after build, via `softprops/action-gh-release`.** The action creates the tag and the Release with generated notes in one step at the built commit, so `normalize` / `git tag` / `git push` / `gh release create` all disappear — and with the input gone, so does the shell-injection guard that made `normalize` pass the version as an env var. Because the version is known before the build, `build-and-push` no longer needs to check out a tag ref; it builds the dispatched ref, which is the same commit the tag will point at. Consequence: a failed build leaves no tag to clean up, replacing today's behavior.

**A `concurrency` group serializing runs (deviation from katsain).** `alepee/calendar-version-action` derives MICRO by reading existing same-month tags, so two overlapping dispatches in one month both compute the same version and the second Release creation fails. `group: images` with `cancel-in-progress: false` queues instead of cancelling — cancelling would abort an in-flight publish half-done.

**Sentry source maps are gated on the affected set.** Uploading api/worker maps for an app that wasn't rebuilt attaches maps to a release with no corresponding image. Each app's build+upload step is gated on membership in the affected set, and the job is skipped entirely when neither api nor worker was built. The existing `SENTRY_AUTH_TOKEN_SET` gate on every step is preserved verbatim. `RELEASE` is the CalVer version on dispatch and `github.sha` on push, matching what each trigger bakes into `SENTRY_RELEASE`.

**`detect` inlines the four-step toolchain preamble.** Turbo runs from `node_modules`, so the job needs `corepack enable` + `actions/setup-node` (`.nvmrc`, yarn cache) + `yarn install --immutable`. Introducing katsain's `.github/actions/setup` composite would only pay off by also rewriting `pr.yml`'s five copies, which is separate work.

## Risks / Trade-offs

- **Affected detection under-builds and GitOps keeps a stale image** → every ambiguous path resolves to all three targets; the mapping module's fail-safe branches are unit tested; the first dispatch after this lands is verified by checking one image per affected app actually appeared in GHCR.
- **Node type-stripping of the `.ts` script misbehaves on the runner** → the acceptance test executes the script through `node` under the repo's pinned Node, so a stripping failure fails CI rather than silently degrading to the build-everything fallback.
- **`alepee/calendar-version-action` is UTC-only and third-party** → only the release-tag string is affected, never application data (which stays Europe/Helsinki elsewhere); a release dispatched near local midnight on a month boundary may land in the next month's series. Accepted, same trade as katsain. The action is pinned to a major.
- **A shallow checkout in the `version` job would restart MICRO at `.0` and collide** → `fetch-depth: 0` is set on `version` and `detect`, and the acceptance test asserts it.
- **Existing `v0.9.x` tags sit below the new series** → CalVer `v2026.7.0` sorts above them and the MICRO counter only matches same-month tags, so no collision; the version series simply becomes non-contiguous, which is expected when switching schemes.
- **Deleting `main.yml` breaks stale references** → `k8s/argocd/application.yaml` comments name `main.yml`; its comments are updated to point at `images.yml` even though its (already broken) `allow-tags` value is deliberately left alone, and `SPEC.md` §CI/CD is updated in the same change.
- **Serialized runs slow down back-to-back merges** → the `concurrency` group queues rather than cancels, so a busy period lengthens the wall clock of the second run; acceptable against the alternative of two runs computing one version.

## Open Questions

None blocking. Two items are deliberately deferred and tracked in the proposal's Impact section rather than resolved here: whether ArgoCD Image Updater should pin `v*` tags for production instead of tracking `main`, and whether `k8s/argocd/application.yaml`'s `allow-tags` regexp should be corrected to match what the workflow actually pushes. Both change deployment behavior and belong in their own change.
