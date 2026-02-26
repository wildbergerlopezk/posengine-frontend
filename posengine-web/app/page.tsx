"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import styles from "./home.module.css"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, tenant } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    } else if (!tenant) {
      router.push("/onboarding")
    } else {
      router.push("/dashboard") 
    }
  }, [isAuthenticated, tenant, router])

  return (
    <div className={styles.container}>
      <div className={styles.loader}>
        <div className={styles.spinner} />
        <span className={styles.text}>Cargando...</span>
      </div>
    </div>
  )
}
