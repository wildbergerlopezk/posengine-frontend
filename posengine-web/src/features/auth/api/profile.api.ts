import { apiClient } from "@/src/shared/api/apiClient"

export const getProfileApi = () =>
  apiClient.get<any>("/auth/profile")
