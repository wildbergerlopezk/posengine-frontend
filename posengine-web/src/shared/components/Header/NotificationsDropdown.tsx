"use client"

import { useState, useRef, useEffect } from "react"
import { Bell, Settings, MoreVertical, AlertTriangle, CheckCircle, Info, AlertCircle } from "lucide-react"
import styles from "./NotificationsDropdown.module.css"

export interface NotificationItem {
  id: string
  type: "info" | "warning" | "success" | "error"
  title: string
  description: string
  createdAt: string
  unread: boolean
  actionLabel?: string
  onAction?: () => void | Promise<void>
  dismissible?: boolean
}

interface NotificationsDropdownProps {
  notifications: NotificationItem[]
}

export function NotificationsDropdown({ notifications }: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = notifications.filter((n) => !dismissed.has(n.id))
  const unreadCount = visible.filter((n) => n.unread).length
  const warnings = visible.filter((n) => n.type === "warning")
  const rest = visible.filter((n) => n.type !== "warning")

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.bellButton}
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Notificaciones del sistema</span>
          </div>

          <div className={styles.panelBody}>
            {warnings.length > 0 && (
              <>
                <span className={styles.sectionLabel}>Importante</span>
                {warnings.map((n) => (
                  <NotificationRow 
                    key={n.id} 
                    item={n} 
                    onDismiss={() => handleDismiss(n.id)}
                  />
                ))}
              </>
            )}

            {rest.length > 0 && (
              <>
                {warnings.length > 0 && <div className={styles.divider} />}
                <span className={styles.sectionLabel}>Más notificaciones</span>
                {rest.map((n) => (
                  <NotificationRow 
                    key={n.id} 
                    item={n}
                    onDismiss={() => handleDismiss(n.id)}
                  />
                ))}
              </>
            )}

            {visible.length === 0 && (
              <p className={styles.emptyState}>No tienes notificaciones</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationRow({ 
  item, 
  onDismiss 
}: { 
  item: NotificationItem
  onDismiss: () => void
}) {
  const [isLoading, setIsLoading] = useState(false)

  const getTypeIcon = () => {
    switch (item.type) {
      case "warning":
        return <AlertTriangle size={18} />
      case "success":
        return <CheckCircle size={18} />
      case "error":
        return <AlertCircle size={18} />
      case "info":
      default:
        return <Info size={18} />
    }
  }

  const getTypeColor = () => {
    switch (item.type) {
      case "warning":
        return "#f59e0b"
      case "success":
        return "#10b981"
      case "error":
        return "#ef4444"
      case "info":
      default:
        return "#3b82f6"
    }
  }

  const handleAction = async () => {
    if (item.onAction) {
      setIsLoading(true)
      try {
        await item.onAction()
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <div className={`${styles.row} ${styles[`row--${item.type}`]}`}>
      {item.unread && <span className={styles.unreadDot} />}
      <div className={styles.rowIcon} style={{ backgroundColor: getTypeColor() }}>
        {getTypeIcon()}
      </div>
      <div className={styles.rowContent}>
        <p className={styles.rowTitle}>{item.title}</p>
        <p className={styles.rowDescription}>{item.description}</p>
        <span className={styles.rowTime}>{item.createdAt}</span>
        {item.actionLabel && (
          <button 
            className={styles.actionButton}
            onClick={handleAction}
            disabled={isLoading}
          >
            {isLoading ? "..." : item.actionLabel}
          </button>
        )}
      </div>
      <div className={styles.rowActions}>
        {item.dismissible !== false && (
          <button 
            className={styles.dismissButton} 
            onClick={onDismiss}
            aria-label="Descartar"
          >
            <MoreVertical size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
