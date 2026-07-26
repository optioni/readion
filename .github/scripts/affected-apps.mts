// Maps `turbo ls --affected --output=json` onto the docker-bake targets that
// produce an image, for the `detect` job in .github/workflows/images.yml.
//
// Run by Node directly (`node .github/scripts/affected-apps.ts`) — no build
// step, no flag: Node strips the types natively. Reads the turbo payload on
// stdin, prints a JSON array of bake target names on stdout.

// Declaration order of the docker-bake.hcl targets, so the emitted set is
// deterministic regardless of the order turbo reports packages in.
const IMAGE_TARGETS = ['api', 'worker', 'web'] as const

const WORKSPACE_SCOPE = '@readion/'

type TurboPackage = { name?: unknown }

/**
 * Under-building is the dangerous failure: a missing image leaves GitOps
 * running a stale one, silently. So any payload we cannot trust resolves to
 * every target rather than to a smaller set.
 */
export function selectImageTargets(raw: string): string[] {
  let items: TurboPackage[]

  try {
    const payload = JSON.parse(raw) as { packages?: { items?: unknown } }
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.packages?.items)) {
      return [...IMAGE_TARGETS]
    }
    items = payload.packages.items
  } catch {
    return [...IMAGE_TARGETS]
  }

  const affected = new Set(
    items
      .map((item) => item?.name)
      .filter((name): name is string => typeof name === 'string' && name.startsWith(WORKSPACE_SCOPE))
      .map((name) => name.slice(WORKSPACE_SCOPE.length)),
  )

  // Shared workspaces (@readion/shared, @readion/db) legitimately appear here —
  // they cause affection but build no image of their own.
  return IMAGE_TARGETS.filter((target) => affected.has(target))
}

if (process.argv[1] === import.meta.filename) {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  process.stdout.write(JSON.stringify(selectImageTargets(Buffer.concat(chunks).toString('utf-8'))))
}
