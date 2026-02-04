"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../store/auth.store"
import { loginApi } from "../api/auth.api"
import type { LoginCredentials } from "../types"

export function useLogin() {
  const router = useRouter()
  const { setUser, setTenant } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const login = async (credentials: LoginCredentials) => {
    setError("")
    setIsLoading(true)

    try {
      if (!credentials.email || !credentials.password) {
        throw new Error("Por favor completa todos los campos")
      }

      const { user, tenant } = await loginApi(credentials)
      setUser(user)
      setTenant(tenant)
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión")
    } finally {
      setIsLoading(false)
    }
  }

  return { login, isLoading, error }
}
