# Kubernetes Base Manifests

Placeholder directory for Kubernetes base manifests.

Full manifests will be added by the `k8s-deployment` change. See `openspec/IMPLEMENTATION-ORDER.md` for the implementation sequence.

## Structure (planned)

- `base/api/` — API server Deployment, Service, HPA
- `base/web/` — Web frontend Deployment, Service
- `base/worker/` — Worker Deployment
- `base/postgres/` — PostgreSQL StatefulSet (or external DB reference)
- `base/redis/` — Redis Deployment
- `overlays/` — Environment-specific patches (dev, staging, prod)
