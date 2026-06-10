export interface ApiKeyCredential {
  type: 'api_key'
  key: string
}

/** OAuth 凭证字段随 provider 扩展，边界处用 Record 建模 */
export interface OAuthCredential {
  type: 'oauth'
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  [key: string]: unknown
}

export type AuthCredential = ApiKeyCredential | OAuthCredential

/** auth.json：provider id → 凭证 */
export type AuthStorageData = Record<string, AuthCredential>
