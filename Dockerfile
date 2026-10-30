# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
#
# Single multi-stage build for every deployable in the monorepo. `deps` and the
# `packages-build` stage (shared + db) are compiled exactly once and reused by
# each app's build stage — build all targets together with `docker buildx bake`
# (see docker-bake.hcl) so buildx shares those stages within one invocation.

# ---- shared base -----------------------------------------------------------
FROM node:24.18-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7 AS base
RUN corepack enable
WORKDIR /app

# ---- dependencies ----------------------------------------------------------
# Manifests only, so this layer is cached until the lockfile or a package.json
# actually changes — never busted by source edits.
FROM base AS deps
COPY package.json .yarnrc.yml yarn.lock* ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
RUN yarn install --frozen-lockfile

# ---- shared workspace packages, compiled once ------------------------------
# Depends only on packages/ source, so changing an app never rebuilds these.
FROM deps AS packages-build
COPY tsconfig.base.json ./
COPY packages/ ./packages/
RUN yarn workspace @readion/shared build && yarn workspace @readion/db build

# ---- per-app compilation (each reuses packages-build) ----------------------
FROM packages-build AS api-build
COPY apps/api/ ./apps/api/
RUN yarn workspace @readion/api build

FROM packages-build AS worker-build
COPY apps/worker/ ./apps/worker/
# Yarn's per-workspace bin shimming omits `nest` for this workspace in the
# Docker build stage (reproducible even though `yarn why` resolves @nestjs/cli
# fine and api's equivalent build works). Invoke the installed binary directly.
RUN cd apps/worker && ../../node_modules/.bin/nest build

FROM packages-build AS web-build
# @readion/shared resolves via its `main` (dist/index.js) — already built in
# packages-build — so Nuxt's bundler can resolve the package entry.
COPY apps/web/ ./apps/web/
RUN yarn workspace @readion/web build

# ---- runtime images --------------------------------------------------------
FROM node:24.18-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7 AS api
WORKDIR /app
ARG SENTRY_RELEASE
ENV NODE_ENV=production
ENV SENTRY_RELEASE=$SENTRY_RELEASE
COPY --from=deps /app/node_modules ./node_modules
COPY --from=api-build /app/apps/api/dist ./apps/api/dist
COPY --from=packages-build /app/packages ./packages
COPY apps/api/package.json ./apps/api/
EXPOSE 3001
CMD ["node", "apps/api/dist/src/main.js"]

FROM node:24.18-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7 AS worker
WORKDIR /app
ARG SENTRY_RELEASE
ENV NODE_ENV=production
ENV SENTRY_RELEASE=$SENTRY_RELEASE
COPY --from=deps /app/node_modules ./node_modules
COPY --from=worker-build /app/apps/worker/dist ./apps/worker/dist
COPY --from=packages-build /app/packages ./packages
COPY apps/worker/package.json ./apps/worker/
CMD ["node", "apps/worker/dist/src/main.js"]

FROM node:24.18-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7 AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=web-build /app/apps/web/.output ./apps/web/.output
COPY apps/web/package.json ./apps/web/
EXPOSE 3000
CMD ["node", "apps/web/.output/server/index.mjs"]
