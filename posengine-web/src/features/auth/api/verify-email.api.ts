import { apiClient } from "@/src/shared/api/apiClient"

export const verifyEmailApi = (token: string) =>
  apiClient.get<any>(`/auth/verify-email?token=${token}`, { skipAuth: true })

export const resendVerificationEmailApi = () =>
  apiClient.post<any>("/auth/resend-verification-email")
