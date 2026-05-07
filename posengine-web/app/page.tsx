"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import styles from "./home.module.css"

export default function HomePage() {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.location.href = isAuthenticated ? "/dashboard" : "/login"
  }, [isAuthenticated])

  return (
    <div className={styles.container}>
      <div className={styles.loader}>
        <div className={styles.spinner} />
        <span className={styles.text}>Cargando...</span>
      </div>
    </div>
  )
}