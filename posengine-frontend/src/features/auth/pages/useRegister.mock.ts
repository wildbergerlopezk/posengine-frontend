"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../store/auth.store"
import type { RegisterCredentials } from "../types"

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function useRegister() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const register = async (credentials: RegisterCredentials) => {
    setError("")

    // Mismas validaciones que el hook real
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
      await delay(800) // Simula llamada al backend

      // Guarda el usuario con los datos que escribió el usuario en el form
      setUser({
        id: "mock-user-id",
        email: credentials.email,
        fullName: credentials.name,
        tenantId: 0,
      })

      router.push("/onboarding")
    } catch (err) {
      setError("Error simulado al registrar")
    } finally {
      setIsLoading(false)
    }
  }

  return { register, isLoading, error }
}