import { apiClient } from "@/src/shared/api/apiClient"

export const refreshTokenApi = (refreshToken: string) =>
  apiClient.post<any>("/auth/refresh", { refreshToken }, { skipAuth: true })
