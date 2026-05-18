"use client"

import React from "react"
import { AlertTriangle, X } from "lucide-react"
import styles from "./ZeroCostWarningModal.module.css"

interface ZeroCostWarningModalProps {
  productNames: string[]
  onClose: () => void
}

export function ZeroCostWarningModal({ productNames, onClose }: ZeroCostWarningModalProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <header className={styles.header}>
          <div className={styles.title}>
            <AlertTriangle size={20} className={styles.warningIcon} />
            <span>Costo en $0</span>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className={styles.content}>
          <p className={styles.message}>
            Los siguientes productos tienen costo <strong>$0</strong>. Editá el costo antes de guardar:
          </p>
          <ul className={styles.productList}>
            {productNames.map(name => (
              <li key={name} className={styles.productItem}>
                <span className={styles.productDot} />
                {name}
              </li>
            ))}
          </ul>
        </div>

        <footer className={styles.footer}>
          <button className={styles.acceptBtn} onClick={onClose} autoFocus>
            Entendido
          </button>
        </footer>

      </div>
    </div>
  )
}
