import type { ContentSource } from '@readion/db'
import { mapSourceToDto } from './content.mapper'

type AuditSnapshot = Record<string, unknown>

export interface AuditSnapshotPair {
  before: AuditSnapshot
  after: AuditSnapshot
}

export function sourceAddedSnapshot(source: ContentSource): AuditSnapshot {
  const dto = mapSourceToDto(source)
  return {
    id: dto.id,
    certificationId: dto.certificationId,
    type: dto.type,
    url: dto.url,
    enabled: dto.enabled,
    lastFetchedAt: dto.lastFetchedAt,
    recheckIntervalMinutes: dto.recheckIntervalMinutes,
    createdAt: dto.createdAt,
  }
}

export function enabledChangeSnapshot(before: boolean, after: boolean): AuditSnapshotPair {
  return {
    before: { enabled: before },
    after: { enabled: after },
  }
}

export function reingestSnapshot(jobId: string): AuditSnapshot {
  return { jobId }
}
