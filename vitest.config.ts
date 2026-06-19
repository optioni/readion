import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'root-smoke',
          include: ['tests/**/*.{spec,test}.ts'],
        },
      },
    ],
  },
})
