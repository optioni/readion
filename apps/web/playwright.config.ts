import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.@(spec|e2e).ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer:
    process.env.READION_E2E_SKIP_WEB_SERVER === '1'
      ? undefined
      : {
          command: 'yarn dev --host 127.0.0.1 --port 3000',
          env: {
            ...process.env,
            NUXT_PUBLIC_API_BASE_URL:
              process.env.NUXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001',
            // Enable the tracker so the plugin injects it; e2e intercepts the script and installs a
            // recording window.umami stub (see e2e/support/umami-e2e.ts).
            NUXT_PUBLIC_UMAMI_HOST:
              process.env.NUXT_PUBLIC_UMAMI_HOST ?? 'https://analytics.optioni.fi',
            NUXT_PUBLIC_UMAMI_WEBSITE_ID:
              process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID ?? 'e2e-website-id',
          },
          url: 'http://127.0.0.1:3000',
          reuseExistingServer: !process.env.CI,
        },
})
