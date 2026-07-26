## ADDED Requirements

### Requirement: Manual CalVer release

A single GitHub Actions workflow SHALL publish images on both push to `main` and manual dispatch. Its `workflow_dispatch` trigger MUST accept no inputs: the release version SHALL be derived from the release date as CalVer `vYYYY.M.MICRO` (month not zero-padded), where `MICRO` starts at `0` for the first release of a given UTC month and increments for each subsequent release in that same month. The version MUST be computed once per run and shared by every job that needs it, so the image tag, the Sentry release and the git tag are identical strings. The version job MUST check out full history, because the `MICRO` counter is derived from existing tags. Overlapping runs of this workflow MUST be serialized rather than cancelled, so two runs cannot derive the same version.

#### Scenario: First dispatch of a month derives .0

- **WHEN** a maintainer dispatches the workflow with no inputs and no `v2026.7.*` tag exists
- **THEN** the derived version is `v2026.7.0`
- **THEN** each published image is tagged `v2026.7.0` and the git tag created is `v2026.7.0`

#### Scenario: Second dispatch of the same month increments MICRO

- **WHEN** the workflow is dispatched again in the same UTC month and `v2026.7.0` already exists
- **THEN** the derived version is `v2026.7.1`
- **THEN** the pre-existing `v2026.7.0` tag, Release and images are left unmodified

#### Scenario: Pre-existing non-CalVer tags do not affect the counter

- **WHEN** the workflow is dispatched while tags `v0.9.0` through `v0.9.7` exist and no `v2026.7.*` tag does
- **THEN** the derived version is `v2026.7.0`
- **THEN** no existing `v0.9.*` tag is rewritten or deleted

### Requirement: Release published only after a successful build

On manual dispatch the workflow SHALL build and push every affected image first, and only then create the git tag and the GitHub Release for the derived version, with auto-generated release notes. A failed image build MUST leave no git tag and no GitHub Release behind. Push to `main` MUST NOT create a tag or a Release.

#### Scenario: Successful dispatch tags and releases

- **WHEN** a dispatched run pushes all affected images successfully
- **THEN** a git tag for the derived version is created at the built commit
- **THEN** a GitHub Release for that tag is created with auto-generated notes

#### Scenario: Failed build publishes nothing

- **WHEN** the image build step of a dispatched run fails
- **THEN** no git tag for the derived version exists
- **THEN** no GitHub Release for the derived version exists

#### Scenario: Push to main never releases

- **WHEN** a commit is pushed to `main`
- **THEN** images are built and pushed tagged with the branch name
- **THEN** no git tag and no GitHub Release are created

### Requirement: Affected-app image builds

On both triggers the workflow SHALL determine which of `api`, `worker` and `web` are affected since the trigger's diff base — the most recent `v*` tag on manual dispatch, the previous commit on push to `main` — from the workspace dependency graph, so a change to a shared `packages/*` workspace marks every consuming app affected. Only affected apps SHALL be built and pushed, within a single build invocation so shared build stages are not recompiled per app. Shared workspaces that produce no image MUST NOT appear in the build set.

The system MUST fail safe to building all three apps whenever the affected set cannot be trusted: an unresolvable diff base, a non-zero exit from the graph query, or unparseable/empty query output. A manual dispatch that resolves to an empty affected set MUST also build all three apps, because a dispatch is an explicit intent to publish. A push to `main` that resolves to an empty affected set builds no image.

#### Scenario: Single-app change builds only that app

- **WHEN** a push to `main` changes only files under `apps/api/`
- **THEN** the build set is `api` alone
- **THEN** no `web` or `worker` image is pushed for that run

#### Scenario: Shared package change fans out to all consumers

- **WHEN** a push to `main` changes files under `packages/shared/`
- **THEN** the build set contains `api`, `worker` and `web`

#### Scenario: Shared workspaces never become build targets

- **WHEN** the graph query reports `@readion/shared` and `@readion/db` as affected alongside `@readion/api`
- **THEN** the build set is `api` alone

#### Scenario: Unresolvable diff base builds everything

- **WHEN** a manual dispatch finds no existing `v*` tag to diff against
- **THEN** the build set contains `api`, `worker` and `web`

#### Scenario: Graph query failure builds everything

- **WHEN** the affected-apps query exits non-zero or emits output that cannot be parsed
- **THEN** the build set contains `api`, `worker` and `web`

#### Scenario: Empty affected set on dispatch still publishes

- **WHEN** a manual dispatch resolves to an empty affected set because nothing changed since the last release tag
- **THEN** the build set contains `api`, `worker` and `web`

#### Scenario: Empty affected set on push builds nothing

- **WHEN** a push to `main` resolves to an empty affected set
- **THEN** no image is built or pushed for that run

### Requirement: Source maps scoped to the published release

The workflow SHALL upload Node source maps to Sentry under a release identifier equal to the value baked into the images built by the same run — the derived CalVer version on manual dispatch, the commit sha on push to `main`. Source maps MUST only be uploaded for apps that were built in that run, and the whole upload MUST be skipped when no Sentry auth token is configured.

#### Scenario: Dispatch uploads maps under the CalVer version

- **WHEN** a dispatched run derives `v2026.7.0` and builds the `api` image
- **THEN** the Sentry release created and finalized is `v2026.7.0`
- **THEN** `api` source maps are uploaded under `v2026.7.0`

#### Scenario: Unbuilt app uploads no maps

- **WHEN** a run's build set is `web` alone
- **THEN** no `api` or `worker` source maps are uploaded

#### Scenario: Missing Sentry token skips the upload

- **WHEN** no Sentry auth token is configured
- **THEN** no Sentry release is created and no source maps are uploaded
- **THEN** the run does not fail

### Requirement: Single-Dockerfile image build

The repository SHALL build every deployable image from one root `Dockerfile` containing a named final stage per app (`api`, `worker`, `web`), driven by a `docker-bake.hcl` bake definition that declares one target per app. The bake definition MUST allow the set of targets built in a run to be selected, and MUST derive image tags from the release/branch tag supplied by CI.

#### Scenario: Root Dockerfile exposes one stage per app

- **WHEN** the repository is inspected
- **THEN** a root `Dockerfile` exists with final stages named `api`, `worker` and `web`
- **THEN** `docker-bake.hcl` declares a target per app, each referencing that root `Dockerfile`

#### Scenario: A subset of targets can be built

- **WHEN** CI builds with the target set restricted to `api` and `worker`
- **THEN** only the `api` and `worker` images are produced and pushed
- **THEN** the shared build stages are compiled once for that invocation

## MODIFIED Requirements

### Requirement: Main-branch image build and tag

A GitHub Actions workflow SHALL run on push to `main` and build a Docker image for each **affected** app among `apps/api`, `apps/web`, and `apps/worker` from the root `Dockerfile`, push it to the container registry, and tag it with the branch name so ArgoCD Image Updater can detect the new digest.

#### Scenario: Push to main publishes the affected images

- **WHEN** a commit is pushed to `main` that affects all three apps
- **THEN** the workflow builds and pushes one image per app (`api`, `web`, `worker`) to the configured registry
- **THEN** each image is tagged such that a digest change is observable for GitOps rollout

#### Scenario: A failing build blocks the publish

- **WHEN** a commit pushed to `main` fails to build any app image
- **THEN** the workflow fails and no partial/broken image set is tagged as the rollout target

## REMOVED Requirements

### Requirement: Per-app Dockerfiles

**Reason**: The repository has no `apps/<name>/Dockerfile`. All three images are built from a single root `Dockerfile` whose named stages (`api`, `worker`, `web`) are driven as targets by `docker-bake.hcl`, so the shared `base`/`deps`/`packages-build` stages compile once per run instead of once per app. The requirement described a structure that does not exist and contradicts the affected-app build requirement added above, which depends on target filtering within one build invocation.

**Migration**: Covered by the "Single-Dockerfile image build" requirement above; no consumer action is needed, as the published image names and tags are unchanged.
