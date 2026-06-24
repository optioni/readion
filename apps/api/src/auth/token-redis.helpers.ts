export const REFRESH_TOKEN_TTL_SECONDS = 604_800
export const VERIFICATION_TOKEN_TTL_SECONDS = 86_400
export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 3_600

export function refreshTokenKey(userId: string, tokenId: string) {
  return `refresh:${userId}:${tokenId}`
}

export function refreshTokenIndexKey(userId: string) {
  return `refresh:${userId}:index`
}

export function singleUseTokenKey(namespace: string, token: string) {
  return `auth:${namespace}:${token}`
}

export function singleUseTokenUserKey(namespace: string, userId: string) {
  return `auth:${namespace}:user:${userId}`
}
