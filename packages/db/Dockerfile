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
COPY package.json .yarnrc.yml yarn.lock* tsconfig.base.json ./
COPY packages/ ./packages/
RUN yarn workspace @readion/shared build
RUN yarn workspace @readion/db build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# packages/db's mikro-orm config uses `useTsNode: true` + a `src/*.ts`
# configPath for local dev (see package.json's "mikro-orm" field). This
# image ships only compiled JS, so point the CLI at the compiled config
# directly to skip ts-node entirely.
ENV MIKRO_ORM_CLI_CONFIG=/app/packages/db/dist/mikro-orm.config.js
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
WORKDIR /app/packages/db
CMD ["/app/node_modules/.bin/mikro-orm", "migration:up"]
