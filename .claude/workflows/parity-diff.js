export const meta = {
  name: 'parity-diff',
  description: 'Diff every design artboard against its app implementation and produce one ranked gap report',
  whenToUse: 'After the design manifest exists and you want the full design/implementation parity gap list across all screens.',
  phases: [{ title: 'Diff', detail: 'one parity-differ agent per screen/state' }],
}

// args is the manifest's artboard list (workflow scripts have no filesystem access,
// so the caller reads openspec/design/manifest.json and passes { artboards: [...] } or the array itself).
// Accept a parsed object/array OR a JSON string of either (arg plumbing sometimes stringifies).
let parsedArgs = args
if (typeof parsedArgs === 'string') {
  try {
    parsedArgs = JSON.parse(parsedArgs)
  } catch {
    parsedArgs = null
  }
}
const specs = Array.isArray(parsedArgs) ? parsedArgs : (parsedArgs?.artboards ?? [])

if (!specs.length) {
  log('No screen specs in args. Pass the manifest artboards as args: { artboards: [{ id, screen, route, state, file }, ...] }.')
  return { error: 'no-specs', findings: [] }
}

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['screen', 'findings'],
  properties: {
    screen: { type: 'string' },
    designInventoryCount: { type: 'integer' },
    appPresentCount: { type: 'integer' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['element', 'class', 'axis', 'severity', 'design', 'app', 'evidence'],
        properties: {
          element: { type: 'string' },
          class: { enum: ['missing', 'simplified', 'divergent'] },
          axis: { enum: ['composition', 'behavioral', 'layout'] },
          severity: { enum: ['high', 'medium', 'low'] },
          design: { type: 'string' },
          app: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
  },
}

function promptFor(s) {
  return [
    `Diff this screen for design/implementation parity.`,
    ``,
    `DESIGN artboard: openspec/design/${s.file}`,
    `Focus on the "${s.state}" state of the "${s.screen}" screen. Read that artboard's named components and its title/description text.`,
    ``,
    `APP route: ${s.route}`,
    `Resolve the app implementation yourself from the route (Nuxt file-based routing under apps/web/app/), following imports into components.`,
    ``,
    `Return the structured JSON report per your instructions.`,
  ].join('\n')
}

phase('Diff')
log(`Diffing ${specs.length} screen(s) against their app implementations.`)

const results = await parallel(
  specs.map((s) => () =>
    agent(promptFor(s), {
      label: `diff:${s.id ?? s.screen}`,
      phase: 'Diff',
      agentType: 'parity-differ',
      schema: FINDINGS_SCHEMA,
    }),
  ),
)

const clean = results.filter(Boolean)
const rank = { high: 0, medium: 1, low: 2 }
const findings = clean
  .flatMap((r) => (r.findings ?? []).map((f) => ({ ...f, screen: r.screen })))
  .sort((a, b) => rank[a.severity] - rank[b.severity])

const bySeverity = { high: 0, medium: 0, low: 0 }
for (const f of findings) bySeverity[f.severity]++

log(`Done: ${findings.length} findings across ${clean.length} screen(s) — ${bySeverity.high} high, ${bySeverity.medium} medium, ${bySeverity.low} low.`)

return { screens: clean.length, totalFindings: findings.length, bySeverity, findings }
