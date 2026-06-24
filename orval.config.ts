import { defineConfig } from 'orval'

export default defineConfig({
  readion: {
    input: {
      target: 'http://localhost:3001/api-json',
    },
    output: {
      target: 'apps/web/src/api/index.ts',
      schemas: 'apps/web/src/api/model',
      client: 'vue-query',
      httpClient: 'fetch',
      mode: 'tags-split',
      tsconfig: './tsconfig.base.json',
      override: {
        mutator: {
          path: 'apps/web/app/api/mutator.ts',
          name: 'readionFetch',
        },
      },
    },
  },
})
