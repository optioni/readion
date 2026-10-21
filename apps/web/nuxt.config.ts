import { defineNuxtConfig } from 'nuxt/config'
import { PUBLIC_AUTH_ROUTES } from './app/constants/publicRoutes'
import { DEFAULT_PAGE_TITLE, SITE_DESCRIPTION, TITLE_TEMPLATE } from './app/utils/seo'

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/color-mode', '@vite-pwa/nuxt', '@nuxtjs/robots'],
  css: ['~/assets/css/main.css'],
  // Defensive-only SEO posture: the whole app is behind auth, so crawlers are disallowed
  // everywhere except the public auth routes, which stay fetchable so link-unfurl bots
  // (Slackbot, Twitterbot) can render share cards for pasted /login and /register links.
  //
  // This block is the declared policy, kept for documentation and in case any other part of
  // the module ecosystem inspects it — but it is NOT what actually produces /robots.txt's
  // response. A wildcard `Disallow: /` makes the module treat the site as "not indexable",
  // and in that state it silently discards `allow` and emits a hardcoded blanket disallow.
  // server/plugins/robots.ts overrides the final output via the module's own
  // robots:robots-txt hook and is the source of truth; keep both in sync via
  // PUBLIC_AUTH_ROUTES.
  robots: {
    disallow: ['/'],
    allow: [...PUBLIC_AUTH_ROUTES],
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
    storageKey: 'readion-color-mode',
  },
  runtimeConfig: {
    // Server-only in-cluster API address for SSR (auth bootstrap + data fetches). Empty by default
    // (local dev reaches the API at the public URL); overridden at runtime via
    // NUXT_INTERNAL_API_BASE_URL in the cluster. See resolveApiBaseUrl.
    internalApiBaseUrl: '',
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? '',
      umamiHost: process.env.NUXT_PUBLIC_UMAMI_HOST ?? '',
      umamiWebsiteId: process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID ?? '',
    },
  },
  site: {
    // Absolute origin used for OG/Twitter share URLs. Defaults to local dev; set
    // NUXT_PUBLIC_SITE_URL in deployed environments to the app's public origin.
    url: process.env.NUXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  },
  app: {
    head: {
      // Default chunk (no per-page title set); titleTemplate composes it — and any
      // page-specific title set via useHead/useSeoMeta — with the site name.
      title: DEFAULT_PAGE_TITLE,
      titleTemplate: TITLE_TEMPLATE,
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/readion.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
      meta: [
        { name: 'theme-color', content: '#0f172a' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: SITE_DESCRIPTION },
      ],
    },
  },
  pwa: {
    strategies: 'injectManifest',
    srcDir: '.',
    filename: 'sw.js',
    registerType: 'autoUpdate',
    includeManifestIcons: false,
    devOptions: {
      enabled: true,
    },
    manifest: {
      name: 'Readion',
      short_name: 'Readion',
      display: 'standalone',
      start_url: '/',
      theme_color: '#0f172a',
      background_color: '#0f172a',
      icons: [
        {
          src: '/icons/readion.svg',
          sizes: '192x192',
          type: 'image/svg+xml',
        },
        {
          src: '/icons/readion.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
        },
      ],
    },
    injectManifest: {
      globPatterns: [],
      injectionPoint: undefined,
      manifestTransforms: [
        async () => ({
          manifest: [],
          warnings: [],
        }),
      ],
    },
  },
  vite: {
    optimizeDeps: {
      include: ['@readion/shared'],
    },
    build: {
      commonjsOptions: {
        include: [/packages\/shared/, /node_modules/],
        transformMixedEsModules: true,
      },
    },
  },
  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          '~/*': ['./app/*'],
          '@/*': ['./app/*'],
        },
      },
      include: ['../tests/**/*', '../e2e/**/*', '../orval.config.ts', '../src/**/*'],
    },
  },
  compatibilityDate: '2025-11-01',
})
