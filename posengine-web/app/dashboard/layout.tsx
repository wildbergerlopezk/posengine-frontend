"use client"

import type React from "react"
import { Sidebar, KeyboardShortcutsModal, OfflineSyncProvider } from "@/src/shared/components"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { getProfileApi } from "@/src/features/auth/api"
import { isAccessTokenValid } from "@/src/features/auth/utils/auth.utils"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useHydrated } from "@/src/shared/hooks/useHydrated"
import styles from "./layout.module.css"
import { useKeyboardNav } from "@/src/shared/hooks/useKeyboardNav"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { accessToken, isAuthenticated, logout } = useAuthStore()
  const router = useRouter()
  const mounted = useHydrated()
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const { showHelp, setShowHelp } = useKeyboardNav()

  useEffect(() => {
    if (!mounted) return

    const validateSession = async () => {
      if (!accessToken || !isAuthenticated || !isAccessTokenValid(accessToken)) {
        logout()
        router.push("/login")
        return
      }

      try {
        const profile = await getProfileApi()
        const currentUser = useAuthStore.getState().user
        if (currentUser) {
          useAuthStore.setState({
            user: {
              ...currentUser,
              name: profile.name ?? currentUser.name,
              email: profile.email ?? currentUser.email,
              tenantId: profile.tenantId ?? currentUser.tenantId,
              emailVerified: typeof profile.emailVerified === "boolean" ? profile.emailVerified : currentUser.emailVerified,
            }
          })
        }
        setIsCheckingSession(false)
      } catch {
        logout()
        router.push("/login")
      }
    }

    void validateSession()
  }, [accessToken, isAuthenticated, logout, mounted, router])

  if (!mounted || isCheckingSession) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    )
  }

  return (
    <OfflineSyncProvider>
      <div className={styles.layout}>
        <Sidebar />
        <main className={styles.main}>{children}</main>
        {showHelp && <KeyboardShortcutsModal onClose={() => setShowHelp(false)} />}
      </div>
    </OfflineSyncProvider>
  )
}
