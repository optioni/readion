## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Add root devDependencies `turbo@^2.10.7` (graph query) and `yaml@^2.9.0` (the acceptance test parses the workflow structurally rather than grepping strings — see design.md Test Boundaries); confirm `yarn install --immutable` is clean and `yarn.lock` updates
- [x] 0.2 RED: write failing `tests/images-workflow.spec.ts` (root-smoke Vitest project, alongside the existing `tests/orval.config.spec.ts` config test) asserting the workflow contract for SPEC.md §CI/CD: `.github/workflows/images.yml` exists while `main.yml` and `release.yml` are gone; triggers are exactly push→`main` and `workflow_dispatch`; the dispatch declares **no** `inputs` ("Manual CalVer release"); top-level `permissions` is `contents: read` + `packages: write`; `concurrency` sets a group with `cancel-in-progress: false`
- [x] 0.3 RED: extend the acceptance test with the per-job assertions — `version`/`detect`/`upload-sourcemaps`/`release` on `ubuntu-latest` and `build-and-push` on the `arm-runners` group; `version` and `detect` check out with `fetch-depth: 0`; the CalVer step uses `dateFormat: YYYY.MM` and `format: v%NOW%.%MICRO%`; `release` is gated `if: github.event_name == 'workflow_dispatch'`, declares job-level `contents: write`, and `needs` `build-and-push` (release-after-build, "Release published only after a successful build"); `build-and-push` derives its bake `targets` from `detect`'s output
- [x] 0.4 RED: extend the acceptance test with the `detect` fail-safe assertions — the resolved step body contains the per-trigger diff-base branches (`git describe --tags --match 'v*' --abbrev=0` vs `github.event.before`), the all-zero-sha guard, the fallback to all three targets on an unresolvable base or non-zero turbo exit, and the empty-set-on-dispatch fallback ("Unresolvable diff base builds everything", "Empty affected set on dispatch still publishes"); plus the `build-and-push` skip condition for an empty set on push ("Empty affected set on push builds nothing")
- [x] 0.5 RED: extend the acceptance test with the source-map gating assertions — `upload-sourcemaps` derives `RELEASE` per trigger, gates each app's steps on membership in `detect`'s output, and retains a `SENTRY_AUTH_TOKEN` gate on every step ("Source maps scoped to the published release", "Missing Sentry token skips the upload")
- [x] 0.6 RED: assert the image-build structure the affected filtering depends on — the root `Dockerfile` declares final stages `api`, `worker` and `web`, and `docker-bake.hcl` declares one target per app referencing that root `Dockerfile` ("Root Dockerfile exposes one stage per app")
- [x] 0.7 RED: write failing `tests/affected-apps.spec.ts` case that executes `node .github/scripts/affected-apps.mts` with fixture stdin and asserts the printed JSON array — this is the boundary that proves the runner can run a `.ts` script unflagged under Node 24 type-stripping (design.md Test Boundaries)
- [x] 0.8 Confirm every new assertion fails for the right reason (missing `images.yml` / missing script), not a harness or import error

## 1. Affected-apps mapping script

- [x] 1.1 RED: unit tests in `tests/affected-apps.spec.ts` for `selectImageTargets(raw)` against captured `turbo ls --affected --output=json` payloads, one per spec scenario: `@readion/api` alone → `['api']`; a `packages/shared` fan-out payload → all three; `@readion/shared` + `@readion/db` + `@readion/api` → `['api']` only ("Shared workspaces never become build targets"); duplicate entries deduped; non-`@readion/` names ignored; empty `packages.items` → `[]`; and the fail-safe — unparseable JSON, missing `packages`, or non-array `items` → `['api','worker','web']` ("Graph query failure builds everything")
- [x] 1.2 GREEN: implement `.github/scripts/affected-apps.mts` — a pure exported `selectImageTargets` plus a CLI entry (`.mts` rather than `.ts`, so Node treats it as ESM without a `type: module` at the workspace root) that reads stdin and prints the JSON array; TypeScript-strict per AGENTS.md, executed by Node's native type-stripping with no build step
- [x] 1.3 REFACTOR: keep the module free of any GitHub Actions or git coupling (it takes JSON in, emits target names out), and comment only the non-obvious WHY — that malformed input deliberately resolves to all three targets because under-building ships a stale image

## 2. Turbo graph configuration

- [x] 2.1 RED: extend `tests/images-workflow.spec.ts` to assert `turbo.json` declares a `build` task with `dependsOn: ['^build']` and `globalDependencies` containing `.nvmrc`, `tsconfig.base.json`, `Dockerfile` and `docker-bake.hcl`, and that root `package.json` declares the `turbo` devDependency
- [x] 2.2 GREEN: add root `turbo.json` with exactly that content; leave `yarn build`/`test`/`typecheck` on `yarn workspaces foreach` (design.md: turbo is a graph-query tool only)
- [x] 2.3 Verify against the real graph: run `TURBO_SCM_BASE=<a commit that touched only apps/api> yarn turbo ls --affected --output=json` and confirm api-only, then repeat with a `packages/shared` commit and confirm all three apps appear ("Shared package change fans out to all consumers")

## 3. images.yml — version, detect and build

- [x] 3.1 GREEN: create `.github/workflows/images.yml` with the two triggers, no dispatch inputs, top-level `permissions` (`contents: read`, `packages: write`) and the serializing `concurrency` group, plus a header comment recording the three deliberate deviations from tv-guide/katsain (ubuntu-latest for non-build jobs, bake `targets` instead of a job matrix, the concurrency group protecting the CalVer MICRO counter)
- [x] 3.2 GREEN: add the `version` job — `actions/checkout` with `fetch-depth: 0`, `alepee/calendar-version-action@v2` (`dateFormat: YYYY.MM`, `format: v%NOW%.%MICRO%`), output shared downstream; comment WHY it runs on push too (a skipped job would skip everything that `needs` it) and WHY full history is required (a shallow checkout restarts MICRO at `.0`)
- [x] 3.3 GREEN: add the `detect` job — inline toolchain preamble (`corepack enable`, `actions/setup-node` with `.nvmrc` + yarn cache, `yarn install --immutable`), diff-base resolution (`git describe --tags --match 'v*' --abbrev=0` on dispatch, `github.event.before` on push with the all-zero sha treated as unresolvable), `TURBO_SCM_BASE="$BASE" yarn turbo ls --affected --output=json` piped into `node .github/scripts/affected-apps.mts`, and the bash-level fail-safes: unresolvable base or non-zero turbo exit → all three, empty set on dispatch → all three, empty set on push → nothing. Emit one `apps` JSON array output
- [x] 3.4 GREEN: add the `build-and-push` job — `arm-runners` group, skipped when `detect` yields an empty set, single `docker/bake-action` invocation with `targets: ${{ join(fromJSON(needs.detect.outputs.apps), ',') }}`, `TAG` = CalVer version on dispatch / `github.ref_name` on push, `SENTRY_RELEASE` = version on dispatch / `github.sha` on push. Drop the old slash-sanitizing tag step and the `ref:` tag checkout
- [x] 3.5 Confirm the group-0 workflow-contract assertions now pass, and sanity-check the filtering with `docker buildx bake --print` restricted to a two-target set ("A subset of targets can be built")

## 4. images.yml — source maps and release

- [x] 4.1 GREEN: port `upload-sourcemaps` — `RELEASE` = CalVer version on dispatch / `github.sha` on push, each app's build+upload gated on `contains(fromJSON(needs.detect.outputs.apps), '<app>')`, the whole job skipped when neither api nor worker was built, and every existing `SENTRY_AUTH_TOKEN_SET` step gate preserved verbatim ("Source maps scoped to the published release")
- [x] 4.2 GREEN: add the `release` job — `if: github.event_name == 'workflow_dispatch'`, job-level `contents: write`, `needs: [version, build-and-push]`, `softprops/action-gh-release@v3` with `tag_name` from the version job and `generate_release_notes: true`; this replaces `normalize` → `git tag` → `git push` → `gh release create` and the injection guard that existed only for the removed input
- [x] 4.3 GREEN: delete `.github/workflows/main.yml` and `.github/workflows/release.yml`
- [x] 4.4 REFACTOR: re-read the finished workflow for leftovers from either source file (unused env, stale comments referencing the removed `version` input or the tag-first ordering) and confirm no path can ever emit a `:latest` tag

## 5. Ripple — stale in-repo references

- [x] 5.1 Update the `TAG` variable comment in `docker-bake.hcl` so the release example reads `v2026.7.0` instead of `v1.4.0`
- [x] 5.2 Update the comments in `k8s/argocd/application.yaml` that name `.github/workflows/main.yml` to name `images.yml`, and correct the claim that the workflow emits `latest` + `sha-<short-sha>` to what it actually pushes (the branch name on push, `v*` on release). Leave the `allow-tags` / `update-strategy` **values** untouched — correcting that mismatch changes what rolls to the cluster and is explicitly out of scope (design.md Non-Goals)

## 6. Acceptance Test — Outer Loop GREEN

- [x] 6.1 Confirm the full acceptance suite passes: `yarn vitest run --project root-smoke` green, including the `node .github/scripts/affected-apps.mts` execution case
- [x] 6.2 Smoke-verify the change's real surface (there is no app to boot for a CI-only change): `yarn install --immutable` clean from scratch, `docker buildx bake --print` resolves for both a full and a restricted target set, `bash k8s/validate.sh` still passes, and `images.yml` parses under `actionlint` if available locally
- [x] 6.3 REFACTOR: de-duplicate the workflow fixtures/helpers shared between `tests/images-workflow.spec.ts` and `tests/affected-apps.spec.ts`
- [x] 6.4 Record the post-merge live verification that no local test can cover (design.md Test Boundaries — the CalVer action is never invoked in tests): the first dispatch after this lands must produce tag `v2026.7.0`, a GitHub Release with generated notes, and one GHCR image per affected app at that tag; a second same-month dispatch must produce `v2026.7.1` while leaving the first tag, Release and images untouched. Note it in the change's completion summary rather than leaving it implicit

## 7. Change Review — Subagent Verification

- [x] 7.1 Dispatch a subagent to review the change against `proposal.md`, the `ci-pipeline` spec scenarios, and `design.md` (reviewer reports findings only, does not edit code)
- [x] 7.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 8. Polish

- [x] 8.1 Run linter and fix all errors (`yarn lint`)
- [x] 8.2 Run formatter and apply fixes (`yarn format:fix`, then `yarn format`)
- [x] 8.3 Run type checker with zero errors (`yarn typecheck`)
- [x] 8.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`); note that `tests/` at the root is outside the per-workspace coverage run, so also confirm the unit tests exercise every branch of `.github/scripts/affected-apps.mts`, including each fail-safe path

## 9. Documentation

- [x] 9.1 Update `SPEC.md` §CI/CD (audience: maintainers making deployment decisions) — replace the current push-to-`main` bullet list with the merged workflow: both triggers in one workflow, images built only for apps affected since the diff base with a documented fail-safe to all apps, and a manual dispatch that takes no input, derives CalVer `vYYYY.M.MICRO`, and cuts the git tag + GitHub Release only after a successful build. This stays useful because it is the only place the release procedure is described for a human deciding how to ship
