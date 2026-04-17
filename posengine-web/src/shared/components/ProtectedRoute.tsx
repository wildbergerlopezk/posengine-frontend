"use client"

import type React from "react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import styles from "./ProtectedRoute.module.css"

interface ProtectedRouteProps {
    children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated } = useAuthStore()
    const router = useRouter()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

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
