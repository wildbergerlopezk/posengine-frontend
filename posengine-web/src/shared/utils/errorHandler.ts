"use client"

import { useEffect } from "react"
import { API_BASE_URL } from "@/src/shared/config/api"
import { useAuthStore } from "@/src/features/auth/store/auth.store"

export function setupGlobalErrorHandlers() {
  if (typeof window === "undefined") return

  const reportError = async (message: string, stack?: string) => {
    try {
      const user = useAuthStore.getState().user
      const userEmail = user ? `${user.name} (${user.email})` : "Invitado"

      await fetch(`${API_BASE_URL}/auth/report-frontend-error`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Request": "true",
        },
        body: JSON.stringify({
          errorMsg: message,
          stack: stack || "No stack trace",
          url: window.location.href,
          user: userEmail,
          userAgent: navigator.userAgent,
        }),
      })
    } catch (err) {
      console.error("Fallo al reportar error al servidor:", err)
    }
  }

  window.addEventListener("error", (event) => {
    if (!event.error) return
    reportError(event.message, event.error.stack)
  })

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    reportError(`Promesa rechazada no controlada: ${message}`, stack)
  })
}

export function ErrorInitializer() {
  useEffect(() => {
    setupGlobalErrorHandlers()
  }, [])
  return null
}
