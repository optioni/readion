import { resolve } from 'node:path'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: false,
  resolve: {
    alias: [
      { find: '@readion/db/src', replacement: resolve(__dirname, '../../packages/db/src') },
      { find: '@readion/db', replacement: resolve(__dirname, '../../packages/db/src/index.ts') },
      { find: '@readion/shared', replacement: resolve(__dirname, '../../packages/shared/src/index.ts') },
    ],
  },
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
        keepClassNames: true,
      },
    }),
  ],
  test: {
    globals: true,
    include: ['src/**/*.{spec,test}.ts'],
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/main.ts'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
      },
    },
  },
})
