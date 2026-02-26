"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "../Sidebar"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import styles from "./DashboardLayout.module.css"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated) {
      router.push("/login")
    } else {
      setIsLoading(false)
    }
  }, [isAuthenticated, router])

  if (isLoading) {
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
