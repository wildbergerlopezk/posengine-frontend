"use client"

import type React from "react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useHydrated } from "@/src/shared/hooks/useHydrated"
import styles from "./ProtectedRoute.module.css"

interface ProtectedRouteProps {
    children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated } = useAuthStore()
    const router = useRouter()
    const mounted = useHydrated()

    useEffect(() => {
        if (mounted && !isAuthenticated) {
            router.push("/login")
        }
    }, [mounted, isAuthenticated, router])

    if (!mounted || !isAuthenticated) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner} />
            </div>
        )
    }

    return <>{children}</>
}
