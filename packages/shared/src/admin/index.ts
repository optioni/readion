import type { RoleValue } from '../auth'
import type { Provenance } from '../grounding'

export const AuditAction = {
  UserRolePromoted: 'user.role.promoted',
  UserRoleDemoted: 'user.role.demoted',
  SourceAdded: 'source.added',
  SourceDisabled: 'source.disabled',
  SourceEnabled: 'source.enabled',
  SourceReingested: 'source.reingested',
  ContentQuarantined: 'content.quarantined',
  CertPublished: 'cert.published',
  CertReverified: 'cert.reverified',
  CertCreated: 'cert.created',
} as const

export const auditActions = [
  AuditAction.UserRolePromoted,
  AuditAction.UserRoleDemoted,
  AuditAction.SourceAdded,
  AuditAction.SourceDisabled,
  AuditAction.SourceEnabled,
  AuditAction.SourceReingested,
  AuditAction.ContentQuarantined,
  AuditAction.CertPublished,
  AuditAction.CertReverified,
  AuditAction.CertCreated,
] as const

export type AuditActionValue = (typeof auditActions)[number]

export interface AdminUserListItem {
  id: string
  email: string
  role: RoleValue
  emailVerified: boolean
  createdAt: string
  enrollmentCount: number
}

export interface AuditLogEntry {
  id: string
  userId: string | null
  action: AuditActionValue
  targetType: string
  targetId: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  createdAt: string
}

export interface RoleChangeResponse {
  id: string
  role: RoleValue
}

export const quarantinedItemStatuses = ['pending', 'approved', 'rejected'] as const

export type QuarantinedItemStatus = (typeof quarantinedItemStatuses)[number]

export interface QuarantinedItemListItem {
  id: string
  certificationId: string
  domain: string
  verdict: string
  reason: string
  status: QuarantinedItemStatus
  provenance: Provenance
  createdAt: string
}
