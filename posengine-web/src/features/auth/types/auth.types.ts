export interface LoginCredentials {
  email: string
  password: string
  isRemember?: boolean
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
  tenantName: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken?: string
  user: {
    id: string
    name: string
    email: string
    tenantId: string | null
    tenantName?: string | null
    emailVerified: boolean
    role: string
  }
}
