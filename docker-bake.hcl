# Builds every deployable from the single root Dockerfile in one invocation so
# the base/deps/packages-build stages compile once and are shared across the
# api, worker and web targets.
#
# Tags/cache refs are derived from variables that CI sets via env vars (bake
# reads env vars matching each `variable` name). Locally, `docker buildx bake`
# uses the defaults below and tags each image :latest.

variable "REGISTRY" {
  default = "ghcr.io"
}

# owner/repo — set to github.repository in CI.
variable "IMAGE_PREFIX" {
  default = "readion/readion"
}

# Primary image tag, e.g. `main` (branch push) or `v2026.7.0` (CalVer release).
variable "TAG" {
  default = "latest"
}

variable "SENTRY_RELEASE" {
  default = ""
}

function "tags" {
  params = [name]
  result = [
    "${REGISTRY}/${IMAGE_PREFIX}/${name}:${TAG}",
  ]
}

group "default" {
  targets = ["api", "worker", "web"]
}

target "_common" {
  context    = "."
  dockerfile = "Dockerfile"
  args = {
    SENTRY_RELEASE = SENTRY_RELEASE
  }
  # Links the GHCR package to this repo (what metadata-action set previously).
  labels = {
    "org.opencontainers.image.source" = "https://github.com/${IMAGE_PREFIX}"
  }
}

target "api" {
  inherits   = ["_common"]
  target     = "api"
  tags       = tags("api")
  cache-from = ["type=registry,ref=${REGISTRY}/${IMAGE_PREFIX}/api:buildcache"]
  cache-to   = ["type=registry,ref=${REGISTRY}/${IMAGE_PREFIX}/api:buildcache,mode=max"]
}

target "worker" {
  inherits   = ["_common"]
  target     = "worker"
  tags       = tags("worker")
  cache-from = ["type=registry,ref=${REGISTRY}/${IMAGE_PREFIX}/worker:buildcache"]
  cache-to   = ["type=registry,ref=${REGISTRY}/${IMAGE_PREFIX}/worker:buildcache,mode=max"]
}

target "web" {
  inherits   = ["_common"]
  target     = "web"
  tags       = tags("web")
  cache-from = ["type=registry,ref=${REGISTRY}/${IMAGE_PREFIX}/web:buildcache"]
  cache-to   = ["type=registry,ref=${REGISTRY}/${IMAGE_PREFIX}/web:buildcache,mode=max"]
}
