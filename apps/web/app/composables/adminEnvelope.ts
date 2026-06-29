import type {
  AdminUserListItem,
  AuditLogEntry,
  CollectionMeta,
  ContentSourceResponse,
  DiscoverSourcesResponse,
  DueForReverificationItem,
  ExtractionStatusResponse,
  IngestionJobStatus,
} from '@readion/shared'

export interface AdminCoverageDomain {
  name: string
  chunkCount: number
  coverage: number
}

export interface AdminCoverageResponse {
  domains: AdminCoverageDomain[]
  overallCoverage: number
}

export const readListEnvelope = <T>(response: {
  data: unknown
}): { data: T[]; meta: CollectionMeta } => response.data as { data: T[]; meta: CollectionMeta }

export const readDataEnvelope = <T>(response: { data: unknown }): T =>
  (response.data as { data: T }).data

export const readUsersEnvelope = (response: {
  data: unknown
}): { data: AdminUserListItem[]; meta: CollectionMeta } =>
  readListEnvelope<AdminUserListItem>(response)

export const readAuditLogsEnvelope = (response: {
  data: unknown
}): { data: AuditLogEntry[]; meta: CollectionMeta } => readListEnvelope<AuditLogEntry>(response)

export const readContentSourcesEnvelope = (response: { data: unknown }): ContentSourceResponse[] =>
  readDataEnvelope<ContentSourceResponse[]>(response)

export const readSourceJobsEnvelope = (response: { data: unknown }): IngestionJobStatus[] =>
  readDataEnvelope<IngestionJobStatus[]>(response)

export const readDiscoverSourcesEnvelope = (response: { data: unknown }): DiscoverSourcesResponse =>
  readDataEnvelope<DiscoverSourcesResponse>(response)

export const readExtractionStatusEnvelope = (response: {
  data: unknown
}): ExtractionStatusResponse => readDataEnvelope<ExtractionStatusResponse>(response)

export const readDueForReverificationEnvelope = (response: {
  data: unknown
}): DueForReverificationItem[] => readDataEnvelope<DueForReverificationItem[]>(response)

export const readCoverageEnvelope = (response: { data: unknown }): AdminCoverageResponse =>
  readDataEnvelope<AdminCoverageResponse>(response)
