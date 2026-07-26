## Why

Releasing today means inventing a version number by hand: `release.yml` takes a required `version` input, normalizes it, then pushes the git tag and cuts the GitHub Release **before** any image is built — so a failed build leaves a dangling tag and a Release pointing at images that do not exist. Meanwhile `main.yml` duplicates the entire build+Sentry pipeline for the push-to-`main` path, and every push rebuilds all three images even when only one app changed. The sibling project (tv-guide/katsain) already runs the shape that fixes all three: one workflow, two triggers, a CalVer version derived from the release date, and image builds limited to the apps actually affected by the change.

## What Changes

- **BREAKING** (release process, not runtime): `.github/workflows/main.yml` and `.github/workflows/release.yml` are deleted and replaced by a single `.github/workflows/images.yml` with two triggers — push to `main` and `workflow_dispatch`.
- **BREAKING**: the manual release dispatch takes **no inputs**. The version is derived as CalVer `vYYYY.M.MICRO` (`v2026.7.0`, then `v2026.7.1` for a second release in the same UTC month) by `alepee/calendar-version-action`. Existing `v0.9.0`–`v0.9.7` tags are left in place; the MICRO counter only considers same-month tags, so there is no collision.
- The git tag and GitHub Release are created **after** a successful image build (`softprops/action-gh-release`, tag + generated notes in one step), so a failed build publishes nothing. This replaces the `normalize` → `git tag` → `git push` → `gh release create` sequence and its shell-injection guard.
- Both triggers build only the apps **affected** since the trigger's diff base (last `v*` tag on dispatch, `github.event.before` on push), derived from the real workspace dependency graph so a `packages/*` change fans out to every consuming app. Any ambiguity fails safe to building all three — never ship a stale image.
- `turbo` is added as a root devDependency plus a minimal `turbo.json`, used **only** as a graph-query tool (`turbo ls --affected`). `yarn build`, `yarn test` and `yarn typecheck` keep using `yarn workspaces foreach`.
- Affected-app filtering feeds `docker/bake-action`'s `targets` input, so the shared `base`/`deps`/`packages-build` stages still compile once per run rather than once per app.
- A `concurrency` group serializes runs, because the CalVer MICRO counter is read from existing tags and two overlapping same-month dispatches would otherwise compute the same version.
- Sentry source-map upload is preserved on both triggers (release version on dispatch, commit sha on push) and is now skipped for apps that were not rebuilt.

## Capabilities

### New Capabilities

None — the release path belongs to the existing `ci-pipeline` capability, which currently has no requirement covering it.

### Modified Capabilities

- `ci-pipeline`: the release path is entirely uncovered by the spec today, so four requirements are **added** — *Manual CalVer release* (dispatch with no input, version derived from the release date, computed once, serialized runs), *Release published only after a successful build* (nothing published when the build fails; push never releases), *Affected-app image builds* (diff base per trigger, dependency-graph fan-out, explicit fail-safes), and *Source maps scoped to the published release* (release identifier matches what was baked into the images, no maps for unbuilt apps). The **Main-branch image build and tag** requirement is **modified** so only affected apps are built. The **Per-app Dockerfiles** requirement is **removed** and replaced by an added *Single-Dockerfile image build* requirement: all three images come from one root `Dockerfile` driven by `docker-bake.hcl` targets, which the removed wording contradicts.

## Impact

- **Workflows**: `.github/workflows/main.yml` and `release.yml` deleted; `.github/workflows/images.yml` added. `pr.yml` untouched.
- **Dependencies**: root `package.json` gains `turbo` (graph query) and `yaml` (the new workflow-contract test parses the YAML instead of grepping it); new root `turbo.json`.
- **Tests**: new root-level `tests/images-workflow.spec.ts` and `tests/affected-apps.spec.ts`, plus a new `.github/scripts/affected-apps.ts` holding the affected-set mapping so it is unit-testable.
- **Docs**: `SPEC.md` §CI/CD gains the manual CalVer release path and the affected-only build note; `docker-bake.hcl`'s `TAG` example comment moves from `v1.4.0` to `v2026.7.0`.
- **Deployment**: behavior unchanged. GitOps still tracks the `main`-tagged images, and no ArgoCD or Kubernetes manifest **value** changes — the only edit under `k8s/` is to the comments in `k8s/argocd/application.yaml` that name the deleted `main.yml` and misdescribe the tags it pushes. Note that the same file's `allow-tags` regexp (`^(latest|sha-.+)$`) already fails to match the `main` tag the current workflow pushes — a pre-existing bug, explicitly **out of scope** here, as is any change to the Image Updater strategy for the new `v*` tags.
- **Out of scope**: GitHub Action major-version bumps (Renovate owns those) and extracting pr.yml's duplicated toolchain preamble into a composite action.
- **Verification**: this repo has no test harness for workflow YAML, so verification is a clean `yarn install --immutable` with `turbo` added, `turbo ls --affected` producing the expected app set locally against a known base, YAML/actionlint sanity on the new workflow, and the first real dispatch producing `v2026.7.0` with images for the affected apps.
