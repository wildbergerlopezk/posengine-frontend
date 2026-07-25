import type React from "react"
import styles from "./AuthCard.module.css"

interface AuthCardProps {
  title?: string
  description?: string
  children: React.ReactNode
}

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <section className={styles.card}>
      <div className={styles.brand}>
        <span className={styles.brandText}>
          POS<span className={styles.brandHighlight}>ENGINE</span>
        </span>
      </div>

      {title && <h1 className={styles.title}>{title}</h1>}

      {description && <p className={styles.description}>{description}</p>}

      {children}
    </section>
  )
}
