#!/usr/bin/env bash
#
# k8s/validate.sh — manifest validation harness for the `k8s-deployment` change.
#
# This is the acceptance gate for infra-as-config: it builds k8s/base with
# kustomize, schema-validates the built output with kubeconform -strict, then
# asserts the structural invariants required by
# openspec/changes/k8s-deployment/specs/kubernetes-deployment/spec.md and
# openspec/changes/k8s-deployment/specs/db-migration-job/spec.md.
#
# It is a STANDALONE script — it is deliberately NOT wired into `yarn test`,
# `yarn lint`, or any other app-level command. Invoke it explicitly:
#
#   k8s/validate.sh
#
# Naming convention this harness assumes (documented here so the manifests
# authored in later task groups match what these assertions look for):
#   - Deployments/Services are named exactly: api, web, worker
#   - The web Ingress is named: web
#   - The shared ConfigMap is named: readion-config
#   - The shared Secret is named: readion-secret
#   - The migration Job is named: db-migrate
#
# Required tooling and how to install it:
#
#   kustomize   — https://github.com/kubernetes-sigs/kustomize
#                 Local (macOS):  brew install kustomize
#                 CI (linux):     curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
#                 A `kubectl` install (which bundles `kubectl kustomize`) is
#                 an accepted substitute and is preferred by this script if
#                 no standalone `kustomize` binary is on PATH.
#
#   kubeconform — https://github.com/yannh/kubeconform
#                 Local (macOS):  brew install kubeconform
#                 CI (linux):     curl -sL "https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz" | tar xz kubeconform && sudo mv kubeconform /usr/local/bin/
#
#   yq          — https://github.com/mikefarah/yq (used for the structural
#                 assertion step over the built multi-document YAML output)
#                 Local (macOS):  brew install yq
#                 CI (linux):     sudo wget -qO /usr/local/bin/yq "https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64" && sudo chmod +x /usr/local/bin/yq
#
set -uo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${BASE_DIR}/.." && pwd)"
K8S_BASE="${REPO_ROOT}/k8s/base"
ARGOCD_APPLICATION="${REPO_ROOT}/k8s/argocd/application.yaml"

BUILT_MANIFEST="$(mktemp -t k8s-validate-build.XXXXXX)"
BUILD_STDERR="$(mktemp -t k8s-validate-build-err.XXXXXX)"
cleanup() { rm -f "${BUILT_MANIFEST}" "${BUILD_STDERR}"; }
trap cleanup EXIT

log() { printf '%s\n' "$1"; }
section() { printf '\n== %s ==\n' "$1"; }

FAILED_ASSERTIONS=0
TOTAL_ASSERTIONS=0

assert() {
  local description="$1"
  local result="$2" # 0 = pass, non-zero = fail
  local detail="${3:-}"
  TOTAL_ASSERTIONS=$((TOTAL_ASSERTIONS + 1))
  if [ "${result}" -eq 0 ]; then
    log "  [PASS] ${description}"
  else
    FAILED_ASSERTIONS=$((FAILED_ASSERTIONS + 1))
    if [ -n "${detail}" ]; then
      log "  [FAIL] ${description} (${detail})"
    else
      log "  [FAIL] ${description}"
    fi
  fi
}

# yq eval-all over the built manifest stream, tolerant of an empty/missing file.
yq_all() {
  local expr="$1"
  yq eval-all "${expr}" "${BUILT_MANIFEST}" 2>/dev/null
}

count_matches() {
  local expr="$1"
  yq_all "${expr}" | grep -c -v '^null$' 2>/dev/null | tr -d '[:space:]' || echo 0
}

# yq over the standalone ArgoCD Application manifest (NOT part of
# k8s/base — it's a CRD kubeconform has no bundled schema for, so it is
# validated separately with -ignore-missing-schemas rather than -strict).
yq_argocd() {
  local expr="$1"
  yq eval "${expr}" "${ARGOCD_APPLICATION}" 2>/dev/null
}

count_argocd_matches() {
  local expr="$1"
  yq_argocd "${expr}" | grep -c -v '^null$' 2>/dev/null | tr -d '[:space:]' || echo 0
}

# ---------------------------------------------------------------------------
# 1. Tooling check — must fail distinctly from "manifests missing".
# ---------------------------------------------------------------------------
section "Tooling check"

TOOLING_OK=1
KUSTOMIZE_CMD=()

if command -v kustomize >/dev/null 2>&1; then
  KUSTOMIZE_CMD=(kustomize build "${K8S_BASE}")
  log "kustomize: $(command -v kustomize)"
elif command -v kubectl >/dev/null 2>&1; then
  KUSTOMIZE_CMD=(kubectl kustomize "${K8S_BASE}")
  log "kustomize: using 'kubectl kustomize' ($(command -v kubectl))"
else
  log "TOOLING MISSING: neither 'kustomize' nor 'kubectl' is installed."
  TOOLING_OK=0
fi

if command -v kubeconform >/dev/null 2>&1; then
  log "kubeconform: $(command -v kubeconform) ($(kubeconform -v 2>&1))"
else
  log "TOOLING MISSING: 'kubeconform' is not installed."
  TOOLING_OK=0
fi

if command -v yq >/dev/null 2>&1; then
  log "yq: $(command -v yq) ($(yq --version 2>&1))"
else
  log "TOOLING MISSING: 'yq' is not installed."
  TOOLING_OK=0
fi

if [ "${TOOLING_OK}" -ne 1 ]; then
  log ""
  log "RESULT: TOOLING MISCONFIGURATION — see install instructions in this script's header."
  exit 2
fi

# ---------------------------------------------------------------------------
# 2. Build — kustomize build k8s/base
# ---------------------------------------------------------------------------
section "kustomize build ${K8S_BASE}"

BUILD_OK=1
if [ ! -d "${K8S_BASE}" ]; then
  log "BUILD FAILED: ${K8S_BASE} does not exist."
  BUILD_OK=0
elif ! "${KUSTOMIZE_CMD[@]}" >"${BUILT_MANIFEST}" 2>"${BUILD_STDERR}"; then
  log "BUILD FAILED: '${KUSTOMIZE_CMD[*]}' exited non-zero."
  log "--- stderr ---"
  sed 's/^/  /' "${BUILD_STDERR}"
  BUILD_OK=0
elif [ ! -s "${BUILT_MANIFEST}" ]; then
  log "BUILD FAILED: kustomize build produced empty output."
  BUILD_OK=0
else
  log "OK — $(grep -c '^kind:' "${BUILT_MANIFEST}" 2>/dev/null || echo 0) resource(s) built."
fi

# ---------------------------------------------------------------------------
# 3. Schema validation — kubeconform -strict (only meaningful if build produced output)
# ---------------------------------------------------------------------------
section "kubeconform -strict"

SCHEMA_OK=1
if [ "${BUILD_OK}" -eq 1 ]; then
  if kubeconform -strict -summary <"${BUILT_MANIFEST}"; then
    log "OK — schema valid."
  else
    log "FAILED — kubeconform reported schema errors."
    SCHEMA_OK=0
  fi
else
  log "SKIPPED — no built manifest to validate (see build failure above)."
  SCHEMA_OK=0
fi

# ---------------------------------------------------------------------------
# 4. Structural invariant assertions (spec: kubernetes-deployment, db-migration-job)
#    These are evaluated against BUILT_MANIFEST even when the build failed —
#    an empty/missing manifest set legitimately fails every "exists" assertion,
#    which is the expected RED state before the manifests are authored.
# ---------------------------------------------------------------------------
section "Structural invariant assertions"

log "(a) apps/api: Deployment + ClusterIP Service"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "api")')
assert "api Deployment exists" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Service" and .metadata.name == "api" and (.spec.type == "ClusterIP" or .spec.type == null))')
assert "api ClusterIP Service exists" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "api") | .spec.template.spec.containers[] | select(.image != null and (.image | test("ghcr.io.*api")))')
assert "api container references the GHCR api image" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "api") | .spec.template.spec.imagePullSecrets[]?')
assert "api pod references a registry pull secret" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "api") | .spec.template.spec.containers[] | select(.livenessProbe.httpGet.path == "/health")')
assert "api liveness probe targets GET /health" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "api") | .spec.template.spec.containers[] | select(.readinessProbe.httpGet.path == "/health")')
assert "api readiness probe targets GET /health" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"

log "(b) apps/web: Deployment + Service + Ingress"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "web")')
assert "web Deployment exists" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Service" and .metadata.name == "web")')
assert "web Service exists" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Ingress" and .metadata.name == "web")')
assert "web Ingress exists" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Ingress" and .metadata.name == "web") | .spec.tls[]?.secretName')
assert "web Ingress declares a TLS secretName" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Ingress" and .metadata.name == "web") | .spec.tls[]?.hosts[]?')
assert "web Ingress TLS block lists a host" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Ingress" and .metadata.name == "web") | .spec.rules[]? | select(.host != null) | .http.paths[]? | select(.backend.service.name == "web")')
assert "web Ingress routes a host rule to the web Service" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Ingress" and .metadata.name == "web") | .spec.rules[]?.http.paths[]? | select(.backend.service.port.number == 3000 or .backend.service.port.name == "http")')
assert "web Ingress backend targets the web Service port 3000/http" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "web") | .spec.template.spec.containers[].env[]? | select(.name == "NODE_ENV" and .valueFrom.configMapKeyRef.name == "readion-config")')
assert "web Deployment sources NODE_ENV from readion-config" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "web") | .spec.template.spec.containers[].env[]? | select(.name == "NUXT_PUBLIC_API_BASE_URL" and .valueFrom.configMapKeyRef.name == "readion-config")')
assert "web Deployment sources NUXT_PUBLIC_API_BASE_URL from readion-config" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "web") | .spec.template.spec.containers[].envFrom[]? | select(.secretRef.name == "readion-secret")')
assert "web Deployment does not reference readion-secret (needs no secret)" "$([ "${n}" -eq 0 ] && echo 0 || echo 1)" "found ${n}"

log "(c) apps/worker: Deployment with scrapper sidecar, no scrapper Service"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "worker")')
assert "worker Deployment exists" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "worker") | .spec.template.spec.containers[] | select(.image != null and (.image | test("amerkurev/scrapper")))')
assert "worker pod has an amerkurev/scrapper sidecar container" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
# .containers | length yields a single scalar line, not one line per match —
# count_matches (built for counting matching documents) can't read it, so
# read the value directly instead of comparing a match-count against 2.
n=$(yq_all 'select(.kind == "Deployment" and .metadata.name == "worker") | .spec.template.spec.containers | length' | head -1)
assert "worker pod has at least two containers (worker + sidecar)" "$([ "${n:-0}" -ge 2 ] 2>/dev/null && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Service" and (.metadata.name | test("scrapper"; "i")))')
assert "no scrapper Service exists" "$([ "${n}" -eq 0 ] && echo 0 || echo 1)" "found ${n}"
n=$(count_matches 'select(.kind == "Deployment" and (.metadata.name | test("scrapper"; "i")))')
assert "no standalone scrapper Deployment exists" "$([ "${n}" -eq 0 ] && echo 0 || echo 1)" "found ${n}"
n=$(count_matches 'select(.kind == "ConfigMap" and .metadata.name == "readion-config") | select(.data.SCRAPPER_URL == "http://localhost:3000")')
assert "readion-config SCRAPPER_URL points at localhost:3000" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "worker") | .spec.template.spec.containers[] | select((.image // "") | test("amerkurev/scrapper")) | .ports[]? | select(.containerPort == 3000)')
assert "scrapper sidecar exposes containerPort 3000 (agrees with SCRAPPER_URL)" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "worker") | .spec.template.spec.containers[] | select(.name == "worker") | .env[]? | select(.name == "SERVICE_NAME" and .value == "readion-worker")')
assert "worker container overrides SERVICE_NAME to readion-worker" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Deployment" and .metadata.name == "worker") | .spec.template.spec.containers[] | select(.name == "worker") | select(.livenessProbe.httpGet != null or .readinessProbe.httpGet != null)')
assert "worker container defines no HTTP liveness/readiness probe" "$([ "${n}" -eq 0 ] && echo 0 || echo 1)" "found ${n}"

log "(d) No Postgres/Redis StatefulSet/Deployment"
n=$(count_matches 'select((.kind == "StatefulSet" or .kind == "Deployment") and (.metadata.name | test("postgres|redis"; "i")))')
assert "no Postgres/Redis StatefulSet or Deployment exists" "$([ "${n}" -eq 0 ] && echo 0 || echo 1)" "found ${n}"

log "(e) Migration Job with ArgoCD PreSync hook"
n=$(count_matches 'select(.kind == "Job" and .metadata.name == "db-migrate")')
assert "db-migrate Job exists" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Job" and .metadata.name == "db-migrate" and .metadata.annotations["argocd.argoproj.io/hook"] == "PreSync")')
assert "db-migrate Job carries argocd.argoproj.io/hook: PreSync" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Job" and .metadata.name == "db-migrate" and .metadata.annotations["argocd.argoproj.io/hook-delete-policy"] != null)')
assert "db-migrate Job carries a hook-delete-policy" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Job" and .metadata.name == "db-migrate") | .spec.template.spec.containers[] | select((((.command // []) + (.args // [])) | join(" ")) | test("migration:up"))')
assert "db-migrate Job runs mikro-orm migration:up" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Job" and .metadata.name == "db-migrate") | .spec.template.spec.containers[] | select(.image != null and (.image | test("ghcr.io.*migrat")))')
assert "db-migrate Job uses a GHCR migration image bundling packages/db" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"

log "(f) Every workload that needs secrets references the ConfigMap + Secret"
# web is intentionally excluded from this loop: per design.md it needs only
# NODE_ENV + NUXT_PUBLIC_API_BASE_URL (both non-secret) and sources them via
# per-key configMapKeyRef rather than envFrom — asserted separately in (b)
# above, alongside an explicit assertion that web does NOT reference
# readion-secret (it has no secret-backed config at all).
for workload in api worker; do
  n=$(count_matches "select(.kind == \"Deployment\" and .metadata.name == \"${workload}\") | .spec.template.spec.containers[].envFrom[]? | select(.configMapRef.name == \"readion-config\")")
  assert "${workload} Deployment references the readion-config ConfigMap" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
  n=$(count_matches "select(.kind == \"Deployment\" and .metadata.name == \"${workload}\") | .spec.template.spec.containers[].envFrom[]? | select(.secretRef.name == \"readion-secret\")")
  assert "${workload} Deployment references the readion-secret Secret" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
done

log "(g) Config/Secret partition — sensitive keys excluded from ConfigMap, present in Secret"
SENSITIVE_KEYS=(DATABASE_URL REDIS_URL JWT_SECRET SMTP_USERNAME SMTP_PASSWORD INTERNAL_API_SECRET SENTRY_DSN DB_PASSWORD)
NON_SENSITIVE_SAMPLE_KEYS=(NODE_ENV LOG_LEVEL)

n=$(count_matches 'select(.kind == "ConfigMap" and .metadata.name == "readion-config")')
assert "readion-config ConfigMap exists" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
n=$(count_matches 'select(.kind == "Secret" and .metadata.name == "readion-secret" and .type == "Opaque")')
assert "readion-secret Opaque Secret exists" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"

for key in "${NON_SENSITIVE_SAMPLE_KEYS[@]}"; do
  n=$(count_matches "select(.kind == \"ConfigMap\" and .metadata.name == \"readion-config\") | .data.${key}")
  assert "ConfigMap carries non-sensitive key ${key}" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
done

for key in "${SENSITIVE_KEYS[@]}"; do
  n=$(count_matches "select(.kind == \"ConfigMap\" and .metadata.name == \"readion-config\") | .data.${key}")
  assert "ConfigMap does not carry sensitive key ${key}" "$([ "${n}" -eq 0 ] && echo 0 || echo 1)" "found in ConfigMap"

  n=$(count_matches "select(.kind == \"Secret\" and .metadata.name == \"readion-secret\") | (.data.${key} // .stringData.${key})")
  assert "Secret defines sensitive key ${key}" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
done

# ---------------------------------------------------------------------------
# 5. GitOps: ArgoCD Application (k8s/argocd/application.yaml)
#    This is a SEPARATE file from k8s/base — the ArgoCD `Application` is a
#    CRD (argoproj.io/v1alpha1) that kubeconform has no bundled schema for,
#    so it is never added to k8s/base/kustomization.yaml (that would break
#    the strict k8s/base build) and is validated on its own here.
# ---------------------------------------------------------------------------
section "(f) GitOps: ArgoCD Application"

if [ ! -f "${ARGOCD_APPLICATION}" ]; then
  log "ArgoCD Application manifest not found at ${ARGOCD_APPLICATION}."
  assert "k8s/argocd/application.yaml exists" 1
else
  assert "k8s/argocd/application.yaml exists" 0

  if command -v kubeconform >/dev/null 2>&1; then
    if kubeconform -ignore-missing-schemas -summary "${ARGOCD_APPLICATION}" >/dev/null 2>&1; then
      assert "kubeconform -ignore-missing-schemas is clean on the ArgoCD Application" 0
    else
      assert "kubeconform -ignore-missing-schemas is clean on the ArgoCD Application" 1
    fi
  fi

  n=$(count_argocd_matches 'select(.kind == "Application")')
  assert "Application kind is Application" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
  n=$(count_argocd_matches 'select(.apiVersion != null and (.apiVersion | test("^argoproj.io/")))')
  assert "Application apiVersion is under argoproj.io" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"

  n=$(yq_argocd '(.spec.source.path // "") + " " + ([.spec.sources[]?.path] | join(" "))' | grep -c 'k8s/base' || echo 0)
  assert "Application source path targets k8s/base" "$([ "${n:-0}" -ge 1 ] && echo 0 || echo 1)"
  n=$(count_argocd_matches '.spec.source.repoURL, .spec.sources[]?.repoURL')
  assert "Application source declares a repoURL" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"

  n=$(count_argocd_matches '.metadata.annotations["argocd-image-updater.argoproj.io/image-list"] | select(test("ghcr.io.*/api"))')
  assert "Image Updater image-list references the GHCR api image" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
  n=$(count_argocd_matches '.metadata.annotations["argocd-image-updater.argoproj.io/image-list"] | select(test("ghcr.io.*/web"))')
  assert "Image Updater image-list references the GHCR web image" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
  n=$(count_argocd_matches '.metadata.annotations["argocd-image-updater.argoproj.io/image-list"] | select(test("ghcr.io.*/worker"))')
  assert "Image Updater image-list references the GHCR worker image" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
  n=$(count_argocd_matches '.metadata.annotations["argocd-image-updater.argoproj.io/image-list"] | select(test("ghcr.io.*/migrations"))')
  assert "Image Updater image-list references the GHCR migrations image" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"

  n=$(count_argocd_matches '.metadata.annotations | to_entries[] | select(.key | test("update-strategy$")) | select(.value == "digest")')
  assert "Image Updater tracks digest changes (update-strategy: digest)" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
  n=$(count_argocd_matches '.metadata.annotations | to_entries[] | select(.key | test("allow-tags$")) | select(.value | test("latest|sha-"))')
  assert "Image Updater watches the latest/sha-* tags" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"

  n=$(count_argocd_matches '.metadata.annotations["argocd-image-updater.argoproj.io/write-back-method"]')
  assert "Image Updater write-back method is set" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"

  n=$(count_argocd_matches '.metadata.annotations | to_entries[] | select(.key | test("pull-secret$")) | select(.value | test("ghcr-pull-secret"))')
  assert "Image Updater references the ghcr-pull-secret" "$([ "${n}" -ge 1 ] && echo 0 || echo 1)"
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
section "Result"

log "${TOTAL_ASSERTIONS} assertion(s) evaluated, ${FAILED_ASSERTIONS} failed."

if [ "${BUILD_OK}" -ne 1 ]; then
  log ""
  log "RESULT: RED — manifests do not exist yet under ${K8S_BASE}."
  log "This is the expected acceptance state before task groups 1-7 author the manifests."
  exit 1
fi

if [ "${SCHEMA_OK}" -ne 1 ] || [ "${FAILED_ASSERTIONS}" -ne 0 ]; then
  log ""
  log "RESULT: FAILING — build succeeded but schema validation or structural assertions failed."
  exit 1
fi

log ""
log "RESULT: PASSING — manifests build, validate, and satisfy all structural invariants."
exit 0
