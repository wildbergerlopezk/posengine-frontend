"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../store/auth.store"
import { loginApi } from "../api"
import type { LoginCredentials } from "../types/auth.types"

export function useLogin() {
  const router = useRouter()
  const { setAuth } = useAuthStore()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const login = async (credentials: LoginCredentials) => {
    setError("")
    setIsLoading(true)

    try {
      const data = await loginApi(credentials)

      setAuth(data)

      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión")
    } finally {
      setIsLoading(false)
    }
  }

  return { login, isLoading, error }
}