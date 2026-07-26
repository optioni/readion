import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { selectImageTargets } from '../.github/scripts/affected-apps.mts'

const ROOT = join(import.meta.dirname, '..')
const SCRIPT = join(ROOT, '.github/scripts/affected-apps.mts')

const ALL = ['api', 'worker', 'web']

const turboOutput = (...names: string[]) =>
  JSON.stringify({
    packageManager: 'berry',
    packages: {
      count: names.length,
      items: names.map((name) => ({ name, path: `packages/${name}` })),
    },
  })

const runScript = (stdin: string) =>
  execFileSync('node', [SCRIPT], { input: stdin, encoding: 'utf-8' }).trim()

describe('selectImageTargets', () => {
  it('maps a single affected app to its bake target', () => {
    expect(selectImageTargets(turboOutput('@readion/api'))).toEqual(['api'])
  })

  it('returns every app when a shared package fans out to all consumers', () => {
    const output = turboOutput(
      '@readion/shared',
      '@readion/db',
      '@readion/api',
      '@readion/worker',
      '@readion/web',
    )
    expect(selectImageTargets(output)).toEqual(ALL)
  })

  it('drops shared workspaces that never produce an image', () => {
    const output = turboOutput('@readion/shared', '@readion/db', '@readion/api')
    expect(selectImageTargets(output)).toEqual(['api'])
  })

  it('ignores workspace names outside the @readion scope', () => {
    const output = turboOutput('@readion/api', 'some-other-pkg', '@vendor/web')
    expect(selectImageTargets(output)).toEqual(['api'])
  })

  it('de-duplicates repeated entries', () => {
    const output = turboOutput('@readion/api', '@readion/api', '@readion/web')
    expect(selectImageTargets(output)).toEqual(['api', 'web'])
  })

  it('emits targets in canonical order regardless of input order', () => {
    const output = turboOutput('@readion/web', '@readion/api', '@readion/worker')
    expect(selectImageTargets(output)).toEqual(ALL)
  })

  it('returns an empty set when nothing is affected', () => {
    expect(selectImageTargets(turboOutput())).toEqual([])
  })

  it('ignores items whose name is not a string', () => {
    const output = JSON.stringify({
      packages: { count: 2, items: [{ path: 'apps/api' }, { name: '@readion/web' }] },
    })
    expect(selectImageTargets(output)).toEqual(['web'])
  })
})

// Under-building ships a stale image, so every untrustworthy input resolves to
// all three targets rather than to a smaller set.
describe('selectImageTargets fail-safes', () => {
  it('falls back to every app on unparseable JSON', () => {
    expect(selectImageTargets('not json at all')).toEqual(ALL)
  })

  it('falls back to every app on empty input', () => {
    expect(selectImageTargets('')).toEqual(ALL)
  })

  it('falls back to every app when the packages key is missing', () => {
    expect(selectImageTargets(JSON.stringify({ packageManager: 'berry' }))).toEqual(ALL)
  })

  it('falls back to every app when items is not an array', () => {
    expect(selectImageTargets(JSON.stringify({ packages: { items: 'api' } }))).toEqual(ALL)
  })

  it('falls back to every app when the payload is not an object', () => {
    expect(selectImageTargets('42')).toEqual(ALL)
  })
})

// The workflow invokes this script as `node .github/scripts/affected-apps.mts`
// with no build step and no flag, which only works because Node strips the
// types natively. Executing it here proves the runner can do that.
describe('affected-apps CLI', () => {
  it('prints the mapped targets as a JSON array', () => {
    expect(JSON.parse(runScript(turboOutput('@readion/api', '@readion/db')))).toEqual(['api'])
  })

  it('prints an empty array when nothing is affected', () => {
    expect(JSON.parse(runScript(turboOutput()))).toEqual([])
  })

  it('prints every target and exits zero on unusable input', () => {
    expect(JSON.parse(runScript('garbage'))).toEqual(ALL)
  })
})
