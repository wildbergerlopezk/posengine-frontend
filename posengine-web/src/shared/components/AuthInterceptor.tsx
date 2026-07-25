"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"

export function AuthInterceptor() {
  useEffect(() => {
    if (typeof window === "undefined") return

    const originalFetch = window.fetch
    let isRefreshing = false
    let refreshQueue: Array<(token: string) => void> = []

    const processQueue = (token: string) => {
      refreshQueue.forEach((callback) => callback(token))
      refreshQueue = []
    }

    const rejectQueue = () => {
      refreshQueue = []
    }

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      
      const isApiRequest = url.includes(API_BASE_URL)
      const isRefreshRequest = url.includes("/auth/refresh")

      const hasClientHeader = init?.headers && (
        (init.headers instanceof Headers && init.headers.has("X-Client-Request")) ||
        (Array.isArray(init.headers) && init.headers.some(([k]) => k.toLowerCase() === "x-client-request")) ||
        (typeof init.headers === "object" && (init.headers as Record<string, string>)["X-Client-Request"])
      )

      if (!isApiRequest || isRefreshRequest || hasClientHeader) {
        return originalFetch(input, init)
      }

      // Intentar realizar la petición original
      let response = await originalFetch(input, init)

      // Si retorna 401, el token expiro. Intentar refrescar.
      if (response.status === 401) {
        const { refreshToken, setAuth, logout } = useAuthStore.getState()

        if (!refreshToken) {
          logout()
          return response
        }

        if (isRefreshing) {
          return new Promise<Response>((resolve) => {
            refreshQueue.push((newToken) => {
              const newInit = { ...init }
              const headers = new Headers(newInit.headers)
              headers.set("Authorization", `Bearer ${newToken}`)
              newInit.headers = headers
              resolve(originalFetch(input, newInit))
            })
          })
        }

        isRefreshing = true

        try {
          const refreshRes = await originalFetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refreshToken }),
          })

          if (refreshRes.ok) {
            const data = await refreshRes.json()
            setAuth({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              user: useAuthStore.getState().user!,
            })

            processQueue(data.accessToken)

            const newInit = { ...init }
            const headers = new Headers(newInit.headers)
            headers.set("Authorization", `Bearer ${data.accessToken}`)
            newInit.headers = headers
            return originalFetch(input, newInit)
          } else {
            logout()
            rejectQueue()
            window.location.href = "/login"
          }
        } catch (err) {
          logout()
          rejectQueue()
          window.location.href = "/login"
        } finally {
          isRefreshing = false
        }
      }

      return response
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return null
}
