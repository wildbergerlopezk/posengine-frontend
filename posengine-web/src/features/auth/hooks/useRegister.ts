"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../store/auth.store"
import { registerUserApi } from "../api/auth.api"
import { RegisterUserDto } from "@/src/shared/types/user/userType.dto"

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
    const dto: RegisterUserDto = {
      fullName: credentials.name,
      email: credentials.email,
      password: credentials.password,
      tenantId: null,
    }

    const user = await registerUserApi(dto)
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
