"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../store/auth.store"
import { registerApi } from "../api/auth.api"
import type { RegisterCredentials } from "../types"

export function useRegister() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const register = async (credentials: RegisterCredentials) => {
    setError("")

    if (credentials.password !== credentials.confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    if (credentials.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }

    setIsLoading(true)

    try {
      if (!credentials.name || !credentials.email || !credentials.password) {
        throw new Error("Por favor completa todos los campos")
      }

      const user = await registerApi(credentials)
      setUser(user)
      router.push("/onboarding")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar")
    } finally {
      setIsLoading(false)
    }
  }

  return { register, isLoading, error }
}
