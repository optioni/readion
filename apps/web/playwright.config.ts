import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
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
              process.env.NUXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1',
          },
          url: 'http://127.0.0.1:3000',
          reuseExistingServer: !process.env.CI,
        },
})
