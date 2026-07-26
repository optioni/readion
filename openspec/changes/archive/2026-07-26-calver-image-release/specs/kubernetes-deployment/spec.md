## MODIFIED Requirements

### Requirement: Per-app Kubernetes workloads

Each application SHALL be deployed as its own Kubernetes workload from the GHCR image built by `.github/workflows/images.yml`: `apps/api` as a `Deployment` fronted by a `ClusterIP` `Service`; `apps/web` as a `Deployment` fronted by a `Service` and exposed via an `Ingress`; `apps/worker` as a `Deployment` with **no** `Service` and **no** `Ingress`.

#### Scenario: API is a Deployment behind a ClusterIP Service

- **WHEN** the base manifests are built
- **THEN** an `apps/api` `Deployment` and a `ClusterIP` `Service` targeting it exist
- **AND** the api container references the GHCR api image and a registry pull secret

#### Scenario: Web is a Deployment exposed via Ingress

- **WHEN** the base manifests are built
- **THEN** an `apps/web` `Deployment`, its `Service`, and an `Ingress` routing the public host to that `Service` exist
- **AND** the `Ingress` is configured to terminate TLS for the app's public domain

#### Scenario: Worker is a Deployment with no ingress

- **WHEN** the base manifests are built
- **THEN** an `apps/worker` `Deployment` exists and there is no `Service` or `Ingress` targeting the worker

### Requirement: GitOps rollout via ArgoCD and Image Updater

Deployment SHALL be driven by an ArgoCD `Application` tracking the `k8s/` manifests, with ArgoCD Image Updater configured to watch the GHCR images pushed by `.github/workflows/images.yml` and trigger a rollout when a new image digest is detected.

#### Scenario: ArgoCD Application tracks the manifests

- **WHEN** the GitOps manifests are built
- **THEN** an ArgoCD `Application` references the `k8s/` base and carries Image Updater annotations for the api, web, and worker GHCR images

#### Scenario: A new image digest triggers a rollout

- **WHEN** `images.yml` pushes a new image and Image Updater detects the digest change
- **THEN** ArgoCD rolls the affected workloads to the new digest
