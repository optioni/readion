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
COPY . .
# @readion/shared resolves via its `main` (dist/index.js), so it must be
# compiled before Nuxt's bundler can resolve the package entry.
RUN yarn workspace @readion/shared build
RUN yarn workspace @readion/web build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.output ./apps/web/.output
COPY apps/web/package.json ./apps/web/
EXPOSE 3000
CMD ["node", "apps/web/.output/server/index.mjs"]
