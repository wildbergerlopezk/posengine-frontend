import React from "react"
import { AlertTriangle, X, Loader2 } from "lucide-react"
import styles from "./ConfirmDialog.module.css"

interface Props {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: "danger" | "warning" | "info"
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  type = "danger",
  loading = false,
  onConfirm,
  onCancel
}: Props) {
  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={`${styles.iconWrapper} ${styles[type]}`}>
            <AlertTriangle size={24} />
          </div>
          <button className={styles.closeBtn} onClick={onCancel} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.message}>{message}</p>
        </div>

        <div className={styles.footer}>
          <button 
            className={styles.cancelBtn} 
            onClick={onCancel} 
            disabled={loading}
          >
            {cancelText}
          </button>
          <button 
            className={`${styles.confirmBtn} ${styles[`confirm-${type}`]}`} 
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 className={styles.spinner} size={18} /> : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
