export interface JwtPayload {
  exp?: number
  [key: string]: unknown
}

export function parseJwtPayload(token?: string | null): JwtPayload | null {
  if (!token) return null

  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const json = decodeURIComponent(
      decoded
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function isAccessTokenExpired(
  token?: string | null
): boolean {
  if (!token) return true
  const payload = parseJwtPayload(token)
  if (!payload?.exp) return true
  return Date.now() >= payload.exp * 1000
}

export function isAccessTokenValid(
  token?: string | null
): boolean {
  return !!token && !isAccessTokenExpired(token)
}
