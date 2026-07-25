import { apiClient } from "@/src/shared/api/apiClient"

export const logoutApi = (refreshToken: string) =>
  apiClient.post<void>("/auth/logout", { refreshToken })
