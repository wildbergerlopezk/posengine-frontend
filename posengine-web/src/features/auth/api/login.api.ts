import { apiClient } from "@/src/shared/api/apiClient"
import type { AuthResponse, LoginCredentials } from "../types/auth.types"

export const loginApi = (credentials: LoginCredentials) =>
  apiClient.post<AuthResponse>("/auth/login", credentials, { skipAuth: true })
