"use client"

import type React from "react"
import { Sidebar } from "@/src/shared/components/Sidebar"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
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
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const { showHelp, setShowHelp } = useKeyboardNav()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push("/login")
    }
  }, [mounted, isAuthenticated, router])

  if (!mounted) {
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
