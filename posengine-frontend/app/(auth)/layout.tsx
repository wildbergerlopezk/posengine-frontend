import type React from "react"
import { Settings } from "lucide-react"
import styles from "./auth-layout.module.css"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.layout}>
      {/* Left side - Form */}
      <div className={styles.formSection}>{children}</div>

      {/* Right side - Branding */}
      <div className={styles.brandingSection}>
        <div className={styles.brandingContent}>
          <div className={styles.brandingBadge}>
            <span className={styles.badgeDot}></span>
            Sistema POS en la Nube
          </div>
          
          <div className={styles.brandingIcon}>
            <Settings size={32} />
          </div>
          
          <h2 className={styles.brandingTitle}>
            POS<span className={styles.brandingTitleGradient}>ENGINE</span>
          </h2>
          
          <p className={styles.brandingDescription}>
            El sistema de punto de venta en la nube más completo para gestionar tu negocio de forma eficiente.
          </p>
          
          <div className={styles.statsGrid}>
            <div className={styles.stat}>
              <p className={styles.statValue}>99.9%</p>
              <p className={styles.statLabel}>Disponibilidad</p>
            </div>
            <div className={styles.stat}>
              <p className={styles.statValue}>+500</p>
              <p className={styles.statLabel}>Negocios</p>
            </div>
            <div className={styles.stat}>
              <p className={styles.statValue}>24/7</p>
              <p className={styles.statLabel}>Soporte</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}