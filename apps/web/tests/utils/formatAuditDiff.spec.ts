import { describe, expect, it } from 'vitest'
import { formatAuditDiff } from '~/utils/formatAuditDiff'

describe('formatAuditDiff', () => {
  it('formats a single-key snapshot as a scalar old → new diff', () => {
    const result = formatAuditDiff({ role: 'user' }, { role: 'admin' })

    expect(result).toEqual({ before: 'user', after: 'admin' })
    expect(`${result.before} → ${result.after}`).toBe('user → admin')
  })

  it('degrades a multi-key snapshot to a compact readable form, not JSON.stringify', () => {
    const result = formatAuditDiff(
      { role: 'user', status: 'active' },
      { role: 'admin', status: 'active' },
    )

    expect(result.before).not.toContain('{')
    expect(result.before).not.toContain('}')
    expect(result.after).not.toContain('{')
    expect(result.after).not.toContain('}')
    expect(result.before).toContain('role: user')
    expect(result.before).toContain('status: active')
    expect(result.after).toContain('role: admin')
  })

  it('degrades a null snapshot to a — placeholder on both sides', () => {
    expect(formatAuditDiff(null, null)).toEqual({ before: '—', after: '—' })
  })

  it('degrades a one-sided null snapshot gracefully', () => {
    expect(formatAuditDiff(null, { role: 'admin' })).toEqual({ before: '—', after: 'admin' })
    expect(formatAuditDiff({ role: 'user' }, null)).toEqual({ before: 'user', after: '—' })
  })

  it('degrades an empty-object snapshot to a — placeholder', () => {
    expect(formatAuditDiff({}, {})).toEqual({ before: '—', after: '—' })
  })
})
