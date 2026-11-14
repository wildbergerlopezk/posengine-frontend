"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../store/auth.store"
import { loginApi } from "../api"
import type { LoginCredentials } from "../types/auth.types"
import { getLoginErrorMessage } from "../utils/auth.utils"

export function useLogin() {
  const router = useRouter()
  const { setAuth } = useAuthStore()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const requestInProgress = useRef(false)

  const login = async (credentials: LoginCredentials) => {
    if (requestInProgress.current) return

    requestInProgress.current = true
    setError("")
    setIsLoading(true)

    try {
      const data = await loginApi(credentials)

      setAuth(data)

      router.push("/dashboard")
    } catch (err) {
      setError(getLoginErrorMessage(err))
    } finally {
      requestInProgress.current = false
      setIsLoading(false)
    }
  }

  return { login, isLoading, error, clearError: () => setError("") }
}
