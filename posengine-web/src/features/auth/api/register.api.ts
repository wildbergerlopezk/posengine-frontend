import { apiClient } from "@/src/shared/api/apiClient"
import type { AuthResponse, RegisterCredentials } from "../types/auth.types"

export const registerApi = (credentials: RegisterCredentials) =>
  apiClient.post<AuthResponse>("/auth/register", credentials, { skipAuth: true })
