import { components } from "@/src/shared/api/schema"

export type LoginCredentials = components["schemas"]["LoginDto"]

export type RegisterCredentials = components["schemas"]["RegisterDto"]

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
