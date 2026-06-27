import { describe, expect, expectTypeOf, it } from 'vitest'
import type { RoleValue } from '../auth'
import {
  type AdminUserListItem,
  AuditAction,
  type AuditActionValue,
  type AuditLogEntry,
  auditActions,
  type RoleChangeResponse,
} from './index'

describe('AuditAction vocabulary', () => {
  it('includes the privileged role-change actions', () => {
    expect(AuditAction.UserRolePromoted).toBe('user.role.promoted')
    expect(AuditAction.UserRoleDemoted).toBe('user.role.demoted')
  })

  it('includes the forward-looking action values', () => {
    expect(AuditAction.SourceAdded).toBe('source.added')
    expect(AuditAction.SourceDisabled).toBe('source.disabled')
    expect(AuditAction.SourceEnabled).toBe('source.enabled')
    expect(AuditAction.SourceReingested).toBe('source.reingested')
    expect(AuditAction.ContentQuarantined).toBe('content.quarantined')
    expect(AuditAction.CertPublished).toBe('cert.published')
    expect(AuditAction.CertReverified).toBe('cert.reverified')
  })

  it('auditActions tuple includes the role-change values', () => {
    expect(auditActions).toContain('user.role.promoted')
    expect(auditActions).toContain('user.role.demoted')
  })

  it('auditActions tuple includes the source lifecycle values', () => {
    expect(auditActions).toContain('source.enabled')
    expect(auditActions).toContain('source.reingested')
  })

  it('exports the AuditActionValue type', () => {
    expectTypeOf<'user.role.promoted'>().toMatchTypeOf<AuditActionValue>()
    expectTypeOf<'user.role.demoted'>().toMatchTypeOf<AuditActionValue>()
    expectTypeOf<'source.enabled'>().toMatchTypeOf<AuditActionValue>()
    expectTypeOf<'source.reingested'>().toMatchTypeOf<AuditActionValue>()
  })
})

describe('AdminUserListItem', () => {
  it('has the documented field shape', () => {
    expectTypeOf<AdminUserListItem>().toEqualTypeOf<{
      id: string
      email: string
      role: RoleValue
      emailVerified: boolean
      createdAt: string
      enrollmentCount: number
    }>()
  })
})

describe('AuditLogEntry', () => {
  it('has the documented field shape', () => {
    expectTypeOf<AuditLogEntry>().toEqualTypeOf<{
      id: string
      userId: string | null
      action: AuditActionValue
      targetType: string
      targetId: string
      before: Record<string, unknown> | null
      after: Record<string, unknown> | null
      createdAt: string
    }>()
  })
})

describe('RoleChangeResponse', () => {
  it('exposes id and role', () => {
    expectTypeOf<RoleChangeResponse>().toEqualTypeOf<{
      id: string
      role: RoleValue
    }>()
  })
})
