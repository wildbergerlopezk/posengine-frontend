"use client"

import type React from "react"
import { Sidebar } from "@/src/shared/components/Sidebar"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { getProfileApi } from "@/src/features/auth/api/auth.api"
import { isAccessTokenValid } from "@/src/features/auth/utils/auth.utils"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import styles from "./layout.module.css"
import { useKeyboardNav } from "@/src/shared/hooks/useKeyboardNav"
import { KeyboardShortcutsModal } from "@/src/shared/components"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { accessToken, isAuthenticated, logout } = useAuthStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const { showHelp, setShowHelp } = useKeyboardNav()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const validateSession = async () => {
      if (!accessToken || !isAuthenticated || !isAccessTokenValid(accessToken)) {
        logout()
        router.push("/login")
        return
      }

      try {
        await getProfileApi(accessToken)
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
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>{children}</main>
      {showHelp && <KeyboardShortcutsModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}
