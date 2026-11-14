import React, { type ReactNode } from "react"
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
  confirmDisabled?: boolean
  children?: ReactNode
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
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: Props) {
  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div data-pos-modal className={styles.dialog} onClick={e => e.stopPropagation()}>
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
          {children && <div className={styles.customContent}>{children}</div>}
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
            disabled={loading || confirmDisabled}
          >
            {loading ? <Loader2 className={styles.spinner} size={18} /> : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
