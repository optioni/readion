import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')

describe('Orval codegen config', () => {
  it('orval.config.ts exists at workspace root', () => {
    expect(existsSync(join(ROOT, 'orval.config.ts'))).toBe(true)
  })

  it('codegen script is defined in root package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    expect(pkg.scripts.codegen).toBeDefined()
    expect(pkg.scripts.codegen).toContain('orval')
  })

  it('config declares vue-query output to apps/web/src/api/', () => {
    const raw = readFileSync(join(ROOT, 'orval.config.ts'), 'utf-8')
    expect(raw).toContain('vue-query')
    expect(raw).toContain('apps/web/src/api/')
  })

  it('config input targets the API /api-json endpoint', () => {
    const raw = readFileSync(join(ROOT, 'orval.config.ts'), 'utf-8')
    expect(raw).toContain('/api-json')
  })
})
