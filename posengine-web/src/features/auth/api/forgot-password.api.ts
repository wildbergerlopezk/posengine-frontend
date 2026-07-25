import { apiClient } from "@/src/shared/api/apiClient"

export const forgotPasswordApi = (email: string) =>
  apiClient.post<void>("/auth/forgot-password", { email }, { skipAuth: true })
