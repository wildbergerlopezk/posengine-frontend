"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { isAccessTokenValid } from "@/src/features/auth/utils/auth.utils"
import styles from "./home.module.css"

export default function HomePage() {
  const { isAuthenticated, accessToken } = useAuthStore()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const shouldRedirectToDashboard = isAuthenticated && isAccessTokenValid(accessToken)
    window.location.href = shouldRedirectToDashboard ? "/dashboard" : "/login"
  }, [isAuthenticated, accessToken])

  return (
    <div className={styles.container}>
      <div className={styles.loader}>
        <div className={styles.spinner} />
        <span className={styles.text}>Cargando...</span>
      </div>
    </div>
  )
}