import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const ROOT = join(import.meta.dirname, '..')
const WORKFLOWS = join(ROOT, '.github/workflows')

type Step = {
  name?: string
  uses?: string
  run?: string
  if?: string
  with?: Record<string, unknown>
}
type Job = {
  'runs-on': string | { group: string }
  needs?: string[]
  if?: string
  permissions?: Record<string, string>
  outputs?: Record<string, string>
  env?: Record<string, string>
  steps: Step[]
}
type Workflow = {
  on: Record<string, { branches?: string[]; inputs?: unknown } | null>
  permissions: Record<string, string>
  concurrency: { group: string; 'cancel-in-progress': boolean }
  jobs: Record<string, Job>
}

const workflow = () =>
  parse(readFileSync(join(WORKFLOWS, 'images.yml'), 'utf-8')) as Workflow

const job = (id: string) => workflow().jobs[id]

const stepWith = (jobId: string, needle: string): Step => {
  const found = job(jobId).steps.find(
    (s) => s.uses?.includes(needle) || s.run?.includes(needle) || s.name?.includes(needle),
  )
  if (!found) throw new Error(`no step matching "${needle}" in job "${jobId}"`)
  return found
}

describe('Images workflow — file layout', () => {
  it('images.yml replaces main.yml and release.yml', () => {
    expect(existsSync(join(WORKFLOWS, 'images.yml'))).toBe(true)
    expect(existsSync(join(WORKFLOWS, 'main.yml'))).toBe(false)
    expect(existsSync(join(WORKFLOWS, 'release.yml'))).toBe(false)
  })

  it('pr.yml is left untouched', () => {
    expect(existsSync(join(WORKFLOWS, 'pr.yml'))).toBe(true)
  })
})

describe('Images workflow — triggers', () => {
  it('triggers on exactly push-to-main and manual dispatch', () => {
    expect(Object.keys(workflow().on).sort()).toEqual(['push', 'workflow_dispatch'])
    expect(workflow().on.push?.branches).toEqual(['main'])
  })

  it('the manual dispatch declares no inputs', () => {
    expect(workflow().on.workflow_dispatch?.inputs).toBeUndefined()
  })

  it('serializes overlapping runs instead of cancelling them', () => {
    expect(workflow().concurrency.group).toBeTruthy()
    expect(workflow().concurrency['cancel-in-progress']).toBe(false)
  })

  it('grants least-privilege permissions at the top level', () => {
    expect(workflow().permissions).toEqual({ contents: 'read', packages: 'write' })
  })
})

describe('Images workflow — runner placement', () => {
  it('runs only the image build on the self-hosted arm group', () => {
    expect(job('build-and-push')['runs-on']).toEqual({ group: 'arm-runners' })
  })

  it.each(['version', 'detect', 'upload-sourcemaps', 'release'])(
    'runs %s on a GitHub-hosted runner',
    (id) => {
      expect(job(id)['runs-on']).toBe('ubuntu-latest')
    },
  )
})

describe('Images workflow — CalVer version', () => {
  it('derives vYYYY.M.MICRO from the release date', () => {
    const step = stepWith('version', 'calendar-version-action')
    expect(step.with?.dateFormat).toBe('YYYY.MM')
    expect(step.with?.format).toBe('v%NOW%.%MICRO%')
  })

  it('checks out full history so the MICRO counter sees existing tags', () => {
    expect(stepWith('version', 'actions/checkout').with?.['fetch-depth']).toBe(0)
    expect(stepWith('detect', 'actions/checkout').with?.['fetch-depth']).toBe(0)
  })

  it('exposes the version as a job output for downstream jobs', () => {
    expect(Object.values(job('version').outputs ?? {}).join()).toContain('steps.calver.outputs')
  })

  it('computes the version on both triggers so downstream needs are not skipped', () => {
    expect(job('version').if).toBeUndefined()
  })
})

describe('Images workflow — affected-app detection', () => {
  const detectScript = () => stepWith('detect', 'affected-apps.ts').run ?? ''

  it('installs the toolchain turbo needs', () => {
    const uses = job('detect').steps.map((s) => s.uses ?? s.run)
    expect(uses).toContain('corepack enable')
    expect(uses).toContain('yarn install --immutable')
    expect(uses.some((u) => u?.includes('actions/setup-node'))).toBe(true)
  })

  it('resolves the diff base from the last release tag on dispatch', () => {
    expect(detectScript()).toContain("git describe --tags --match 'v*' --abbrev=0")
  })

  it('resolves the diff base from the previous commit on push', () => {
    expect(detectScript()).toContain('github.event.before')
  })

  it('treats the all-zero sha as an unresolvable base', () => {
    expect(detectScript()).toContain('0000000000000000000000000000000000000000')
  })

  it('queries the workspace dependency graph for affected packages', () => {
    expect(detectScript()).toContain('turbo ls --affected --output=json')
    expect(detectScript()).toContain('TURBO_SCM_BASE')
  })

  it('maps the graph output with the unit-tested script', () => {
    expect(detectScript()).toContain('node .github/scripts/affected-apps.ts')
  })

  it('falls back to every app whenever the affected set is untrustworthy', () => {
    // One fallback assignment per untrustworthy path: unresolvable base,
    // non-zero turbo exit, and unusable mapping output.
    const fallbacks = detectScript().match(/apps=\$ALL/g) ?? []
    expect(fallbacks.length).toBeGreaterThanOrEqual(3)
    expect(detectScript()).toContain(`ALL='["api","worker","web"]'`)
  })

  it('publishes every app when a dispatch resolves to an empty set', () => {
    expect(detectScript()).toMatch(/APPS.*=.*"\[\]".*workflow_dispatch|workflow_dispatch[\s\S]*APPS="\$ALL"/)
  })

  it('exposes the affected apps as a JSON array output', () => {
    expect(Object.keys(job('detect').outputs ?? {})).toContain('apps')
  })
})

describe('Images workflow — build and push', () => {
  it('builds nothing when a push affects no app', () => {
    expect(job('build-and-push').if).toContain("needs.detect.outputs.apps != '[]'")
  })

  it('bakes only the affected targets in a single invocation', () => {
    const bake = stepWith('build-and-push', 'docker/bake-action')
    expect(bake.with?.targets).toContain("join(fromJSON(needs.detect.outputs.apps), ',')")
    expect(bake.with?.push).toBe(true)
    expect(bake.with?.files).toBe('./docker-bake.hcl')
  })

  it('tags the CalVer version on dispatch and the branch name on push', () => {
    const bake = stepWith('build-and-push', 'docker/bake-action') as Step & {
      env: Record<string, string>
    }
    expect(bake.env.TAG).toContain('needs.version.outputs')
    expect(bake.env.TAG).toContain('github.ref_name')
    expect(bake.env.SENTRY_RELEASE).toContain('needs.version.outputs')
    expect(bake.env.SENTRY_RELEASE).toContain('github.sha')
  })

  it('builds the dispatched commit rather than checking out a pre-created tag', () => {
    expect(stepWith('build-and-push', 'actions/checkout').with).toBeUndefined()
  })

  it('never emits a :latest tag', () => {
    expect(readFileSync(join(WORKFLOWS, 'images.yml'), 'utf-8')).not.toContain(':latest')
  })
})

describe('Images workflow — Sentry source maps', () => {
  it('keys the release to what was baked into the images', () => {
    const release = job('upload-sourcemaps').env?.RELEASE ?? ''
    expect(release).toContain('needs.version.outputs')
    expect(release).toContain('github.sha')
  })

  it('skips the job when neither api nor worker was built', () => {
    const gate = job('upload-sourcemaps').if ?? ''
    expect(gate).toContain("contains(fromJSON(needs.detect.outputs.apps), 'api')")
    expect(gate).toContain("contains(fromJSON(needs.detect.outputs.apps), 'worker')")
  })

  it('gates every step on a configured Sentry token', () => {
    for (const step of job('upload-sourcemaps').steps) {
      expect(step.if ?? '').toContain('SENTRY_AUTH_TOKEN_SET')
    }
  })

  it('uploads an app’s maps only when that app was built', () => {
    for (const app of ['api', 'worker']) {
      const upload = job('upload-sourcemaps').steps.filter((s) =>
        s.run?.includes(`upload-sourcemaps apps/${app}/dist`),
      )
      expect(upload).toHaveLength(1)
      expect(upload[0]?.if).toContain(`fromJSON(needs.detect.outputs.apps), '${app}'`)
    }
  })
})

describe('Images workflow — release', () => {
  it('cuts a release only on manual dispatch', () => {
    expect(job('release').if).toContain("github.event_name == 'workflow_dispatch'")
  })

  it('creates the tag and release only after the build succeeded', () => {
    expect(job('release').needs).toEqual(expect.arrayContaining(['version', 'build-and-push']))
  })

  it('is the only job granted write access to repository contents', () => {
    expect(job('release').permissions).toEqual({ contents: 'write' })
    for (const [id, definition] of Object.entries(workflow().jobs)) {
      if (id !== 'release') expect(definition.permissions?.contents).not.toBe('write')
    }
  })

  it('tags the derived version and generates notes', () => {
    const step = stepWith('release', 'action-gh-release')
    expect(step.with?.tag_name).toContain('needs.version.outputs')
    expect(step.with?.generate_release_notes).toBe(true)
  })

  it('no longer tags or releases by hand', () => {
    const raw = readFileSync(join(WORKFLOWS, 'images.yml'), 'utf-8')
    expect(raw).not.toContain('git tag')
    expect(raw).not.toContain('gh release create')
  })
})

describe('Turbo graph configuration', () => {
  const turboConfig = () => JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf-8'))

  it('declares the build task and its topological dependency', () => {
    expect(turboConfig().tasks.build.dependsOn).toEqual(['^build'])
  })

  it('treats image-affecting root files as global dependencies', () => {
    expect(turboConfig().globalDependencies).toEqual(
      expect.arrayContaining(['.nvmrc', 'tsconfig.base.json', 'Dockerfile', 'docker-bake.hcl']),
    )
  })

  it('declares turbo as a root devDependency', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    expect(pkg.devDependencies.turbo).toBeDefined()
  })

  it('keeps yarn workspaces foreach as the task runner', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    expect(pkg.scripts.build).toContain('workspaces foreach')
    expect(pkg.scripts.build).not.toContain('turbo')
  })
})

describe('Image build structure the target filtering depends on', () => {
  it('exposes one final stage per app in the root Dockerfile', () => {
    const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf-8')
    for (const app of ['api', 'worker', 'web']) {
      expect(dockerfile).toMatch(new RegExp(`^FROM .+ AS ${app}$`, 'm'))
    }
  })

  it('declares one bake target per app against the root Dockerfile', () => {
    const bake = readFileSync(join(ROOT, 'docker-bake.hcl'), 'utf-8')
    for (const app of ['api', 'worker', 'web']) {
      expect(bake).toMatch(new RegExp(`target "${app}"`))
    }
    expect(bake).toContain('dockerfile = "Dockerfile"')
  })
})
