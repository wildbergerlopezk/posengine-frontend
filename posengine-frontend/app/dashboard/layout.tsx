"use client"

import type React from "react"
import { Sidebar } from "@/src/shared/components/Sidebar"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import styles from "./layout.module.css"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, tenant } = useAuthStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push("/login")
    } else if (mounted && !tenant) {
      router.push("/onboarding")
    }
  }, [mounted, isAuthenticated, tenant, router])

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
    </div>
  )
}
