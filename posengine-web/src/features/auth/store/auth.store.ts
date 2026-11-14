"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { AuthResponse } from "../types/auth.types"
import { clearLabelDraftOnLogout } from "@/src/features/labels/store/labelDraft.store"
import { invalidateCommercialCapabilities } from "@/src/shared/hooks/commercialCapabilitiesCache.mjs"

type AuthUser = AuthResponse["user"]

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (data: AuthResponse) => void
  logout: () => void
}

// Earlier builds persisted bearer and refresh tokens in localStorage. Remove that
// legacy entry so this version keeps authentication state within the browser tab.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("auth-storage")
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: ({ user, accessToken, refreshToken }) => {
        invalidateCommercialCapabilities()
        set({
          user,
          accessToken,
          refreshToken: refreshToken || null,
          isAuthenticated: true,
        })
      },

      logout: () => {
        invalidateCommercialCapabilities()
        clearLabelDraftOnLogout()
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
