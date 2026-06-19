## ADDED Requirements

### Requirement: Pull-request quality gate

A GitHub Actions workflow SHALL run on every pull request and execute, across all workspaces, typecheck (`tsc --noEmit`), lint and format check (`biome check`), tests (`vitest run`) with Testcontainers, and a build of all apps. Any failing step SHALL fail the workflow.

#### Scenario: A clean PR passes all checks

- **WHEN** a pull request is opened whose code typechecks, is lint/format clean, has passing tests at ≥80% coverage, and builds
- **THEN** the PR workflow completes with all jobs green

#### Scenario: A lint or format violation fails the PR

- **WHEN** a pull request introduces code that violates `biome check`
- **THEN** the PR workflow fails on the lint/format step and reports a non-zero status

#### Scenario: Coverage below threshold fails the PR

- **WHEN** a pull request drops line or branch coverage below 80%
- **THEN** the test job fails the workflow

### Requirement: Main-branch image build and tag

A GitHub Actions workflow SHALL run on push to `main` and build a Docker image for each of `apps/api`, `apps/web`, and `apps/worker` from that app's `Dockerfile`, push it to the container registry, and tag it so ArgoCD Image Updater can detect the new digest.

#### Scenario: Push to main publishes three images

- **WHEN** a commit is pushed to `main`
- **THEN** the workflow builds and pushes one image per app (`api`, `web`, `worker`) to the configured registry
- **THEN** each image is tagged such that a digest change is observable for GitOps rollout

#### Scenario: A failing build blocks the publish

- **WHEN** a commit pushed to `main` fails to build any app image
- **THEN** the workflow fails and no partial/broken image set is tagged as the rollout target

### Requirement: Per-app Dockerfiles

Each app SHALL provide a `Dockerfile` at `apps/<name>/Dockerfile` that produces a runnable image.

#### Scenario: Each app has a Dockerfile

- **WHEN** the repository is inspected
- **THEN** `apps/api/Dockerfile`, `apps/web/Dockerfile`, and `apps/worker/Dockerfile` all exist
