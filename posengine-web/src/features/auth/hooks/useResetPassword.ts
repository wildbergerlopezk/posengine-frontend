"use client"

import { useState } from "react"
import { resetPasswordApi } from "../api/auth.api"

export function useResetPassword() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const resetPassword = async (token: string, password: string) => {
    setIsLoading(true)
    setError(null)
    setIsSuccess(false)

    try {
      await resetPasswordApi(token, password)
      setIsSuccess(true)
    } catch (err) {
      setError("No se pudo restablecer la contraseña. El enlace puede haber expirado o ser inválido.")
    } finally {
      setIsLoading(false)
    }
  }

  return { resetPassword, isLoading, error, isSuccess }
}
