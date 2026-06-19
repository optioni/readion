import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      name: 'root-smoke',
      include: ['tests/**/*.{spec,test}.ts'],
    },
  },
])
