import { apiClient } from "@/src/shared/api/apiClient"

export const resetPasswordApi = (token: string, password: string) =>
  apiClient.post<void>("/auth/reset-password", { token, password }, { skipAuth: true })
