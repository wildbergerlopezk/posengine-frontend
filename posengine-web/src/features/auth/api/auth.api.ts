import type { AuthResponse, LoginCredentials, RegisterCredentials } from "../types"
import { API_BASE_URL } from "@/src/shared/config/api"

const BASE_URL = API_BASE_URL

async function request<T>(path: string, method: string = "POST", body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(data?.message || "Error en la solicitud")
  }

  return data
}

export const loginApi = (credentials: LoginCredentials) =>
  request<AuthResponse>("/auth/login", "POST", credentials)

export const registerApi = (credentials: RegisterCredentials) =>
  request<AuthResponse>("/auth/register", "POST", credentials)

export const getProfileApi = (token: string) =>
  request<any>("/auth/profile", "GET", undefined, token)

export const forgotPasswordApi = (email: string) =>
  request<void>("/auth/forgot-password", "POST", { email })

export const resetPasswordApi = (token: string, password: string) =>
  request<void>("/auth/reset-password", "POST", { token, password })

export const verifyEmailApi = (token: string) =>
  request<any>(`/auth/verify-email?token=${token}`, "GET")

export const resendVerificationEmailApi = (accessToken: string) =>
  request<any>("/auth/resend-verification-email", "POST", undefined, accessToken)