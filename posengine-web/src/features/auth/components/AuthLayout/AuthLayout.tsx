import type React from "react"
import styles from "./AuthLayout.module.css"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return <div className={styles.container}>{children}</div>
}
