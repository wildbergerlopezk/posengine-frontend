"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../store/auth.store"
import { registerApi } from "../api"
import type { RegisterCredentials } from "../types/auth.types"

export function useRegister() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const register = async (credentials: RegisterCredentials) => {
    setError("")

    if (!credentials.password) {
      setError("La contraseña es requerida")
      return
    }

    setIsLoading(true)
    try {
      const data = await registerApi(credentials)
      setAuth(data)
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar")
    } finally {
      setIsLoading(false)
    }
  }

  return { register, isLoading, error }
}