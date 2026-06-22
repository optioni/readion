import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/color-mode', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
    storageKey: 'readion-color-mode',
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? '',
    },
  },
  app: {
    head: {
      link: [{ rel: 'manifest', href: '/manifest.webmanifest' }],
      meta: [
        { name: 'theme-color', content: '#0f172a' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
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
