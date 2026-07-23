import type React from "react"
import styles from "./auth-layout.module.css"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.layout}>
      {/* Left side - Header + Form Container */}
      <div className={styles.leftSection}>
        <div className={styles.header}>
          <img
            src="/ico.png"
            alt="Elytech Logo"
            width={24}
            height={24}
            style={{ objectFit: "contain" }}
          />
          <span className={styles.logoText}>
            POS<span className={styles.logoHighlight}>ENGINE</span>
          </span>
        </div>

        <div className={styles.formContainer}>
          <div className={styles.formInner}>{children}</div>
        </div>
      </div>

      {/* Right side - Supabase-style Testimonial Section */}
      <div className={styles.rightSection}>
        <div className={styles.quoteContainer}>
          <span className={styles.quoteMark}>“</span>
          <p className={styles.quoteText}>
            Invertir en Pos<span className={styles.inlineHighlight}>Engine</span> significa invertir en productividad, control y crecimiento a largo plazo.
          </p>
          <div className={styles.authorContainer}>
            <div className={styles.avatar}>OW</div>
            <div className={styles.authorInfo}>
              <span className={styles.authorName}>Olaf Wildberger</span>
              <span className={styles.authorHandle}>@_Wildberger</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}