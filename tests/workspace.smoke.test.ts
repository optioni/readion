import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')

describe('Workspace topology', () => {
  it('yarn workspaces list emits exactly five members', () => {
    const output = execSync('yarn workspaces list --json', {
      cwd: ROOT,
      encoding: 'utf-8',
    })
    const lines = output.trim().split('\n').filter(Boolean)
    const workspaces = lines.map((line) => JSON.parse(line))
    const locations = workspaces
      .filter((w: { location: string }) => w.location !== '.')
      .map((w: { location: string }) => w.location)
      .sort()

    expect(locations).toEqual(
      ['apps/api', 'apps/web', 'apps/worker', 'packages/db', 'packages/shared'].sort(),
    )
  })

  it('root node_modules exists proving nodeLinker: node-modules', () => {
    expect(existsSync(join(ROOT, 'node_modules'))).toBe(true)
  })

  it('.nvmrc is 24.18', () => {
    const nvmrc = readFileSync(join(ROOT, '.nvmrc'), 'utf-8').trim()
    expect(nvmrc).toBe('24.18')
  })

  it('TypeScript base config has strict mode enabled', () => {
    const raw = readFileSync(join(ROOT, 'tsconfig.base.json'), 'utf-8')
    const tsconfig = JSON.parse(raw)
    expect(tsconfig.compilerOptions.strict).toBe(true)
  })
})
