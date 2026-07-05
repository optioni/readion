FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json .yarnrc.yml yarn.lock* ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
RUN yarn install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json .yarnrc.yml yarn.lock* ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/
# `yarn workspace @readion/worker build` fails here: Yarn's per-workspace bin
# shimming omits `nest` for this workspace in the Docker build stage (unclear
# why — reproducible even though @nestjs/cli resolves correctly per `yarn why`
# and api's equivalent build works fine). Invoke the installed binary directly
# to sidestep it.
RUN cd apps/worker && ../../node_modules/.bin/nest build

FROM node:24-slim AS runner
WORKDIR /app
ARG SENTRY_RELEASE
ENV NODE_ENV=production
ENV SENTRY_RELEASE=$SENTRY_RELEASE
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY apps/worker/package.json ./apps/worker/
CMD ["node", "apps/worker/dist/src/main.js"]
