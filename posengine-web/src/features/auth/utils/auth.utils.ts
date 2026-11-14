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

export function validateLoginCredentials(email: string, password: string): string | null {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) return 'Ingresá tu correo electrónico.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return 'Ingresá un correo electrónico válido.';
  }
  if (password.length === 0) return 'Ingresá tu contraseña.';
  return null;
}

export function getLoginErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Ocurrió un error inesperado. Intentá nuevamente más tarde.';
  }

  const apiError = error as { status?: unknown; code?: unknown };
  if (apiError.code === 'NETWORK_ERROR' || apiError.status === 0) {
    return 'No pudimos conectar con el servidor. Intentá nuevamente.';
  }
  if (apiError.status === 401) return 'Correo o contraseña incorrectos.';
  if (apiError.status === 403) return 'No tenés permisos para iniciar sesión.';
  if (apiError.status === 429) return 'Demasiados intentos. Esperá un momento e intentá nuevamente.';
  if (apiError.status === 503) return 'No pudimos conectar con el servidor. Intentá nuevamente.';
  if (apiError.status === 400) return 'Revisá los datos ingresados.';

  return 'Ocurrió un error inesperado. Intentá nuevamente más tarde.';
}
