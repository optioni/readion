export const DUE_ITEMS_PROVIDER = Symbol('DUE_ITEMS_PROVIDER')

export type DueTarget = { domain: string; anchorChunkId: string }

export interface DueItemsProvider {
  getDueTargets(userId: string, enrollmentId: string): Promise<DueTarget[]>
}
