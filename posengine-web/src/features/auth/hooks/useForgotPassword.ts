"use client"

import { useState } from "react"
import { forgotPasswordApi } from "../api"

export function useForgotPassword() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const forgotPassword = async (email: string) => {
    setIsLoading(true)
    setError(null)
    setIsSuccess(false)

    try {
      await forgotPasswordApi(email)
      setIsSuccess(true)
    } catch (err) {
      // No mostrar errores internos, mostrar error genérico/seguro
      setError("No pudimos procesar la solicitud. Intenta nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return { forgotPassword, isLoading, error, isSuccess }
}
