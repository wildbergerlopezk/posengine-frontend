"use client"

import { useEffect, useState } from "react"
import { Construction, ArrowLeft } from "lucide-react"
import Link from "next/link"
import styles from "./UnderConstruction.module.css"

interface Props {
  moduleName?: string
}

export function UnderConstruction({ moduleName }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className={styles.container}>
      {/* Fondo decorativo */}
      <div className={styles.bgGrid} />
      <div className={styles.bgGlow} />

      <div className={`${styles.content} ${mounted ? styles.contentVisible : ""}`}>

        {/* Ícono animado */}
        <div className={styles.iconWrapper}>
          <div className={styles.iconRing} />
          <div className={styles.iconRing2} />
          <div className={styles.iconInner}>
            <Construction size={32} />
          </div>
        </div>

        {/* Badge del módulo */}
        {moduleName && (
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            {moduleName}
          </div>
        )}

        {/* Texto */}
        <div className={styles.textBlock}>
          <h2 className={styles.title}>En construcción</h2>
          <p className={styles.description}>
            Este módulo está siendo desarrollado y estará disponible muy pronto.
          </p>
        </div>

        {/* Barra de progreso decorativa */}
        <div className={styles.progressWrapper}>
          <div className={styles.progressHeader}>
            <span>Progreso de desarrollo</span>
            <span>60%</span>
          </div>
          <div className={styles.progressTrack}>
            <div className={`${styles.progressBar} ${mounted ? styles.progressBarFill : ""}`} />
          </div>
        </div>

        {/* Volver */}
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowLeft size={15} />
          Volver al Dashboard
        </Link>

      </div>
    </div>
  )
}