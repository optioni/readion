import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~~': resolve(__dirname),
      '~': resolve(__dirname, 'app'),
      '@': resolve(__dirname, 'app'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.{spec,test}.ts'],
    coverage: {
      provider: 'v8',
      include: ['app/pages/**/*.vue', 'app/components/**/*.vue', 'app/composables/**/*.ts'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
      },
    },
  },
})
