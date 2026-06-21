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
      mode: 'tags-split',
    },
  },
})
