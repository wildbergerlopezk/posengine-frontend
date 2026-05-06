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