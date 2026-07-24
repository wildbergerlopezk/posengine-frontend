"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useHydrated } from "@/src/shared/hooks/useHydrated"
import { Search, Bell, Sun, Moon, Menu, Keyboard } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { useUIStore } from "@/src/shared/store/ui.store"
import { NotificationsDropdown, type NotificationItem } from "./NotificationsDropdown"
import styles from "./Header.module.css"

interface HeaderProps {
  title: string
  subtitle?: string
  onMenuClick?: () => void
}

export function Header({
  title,
  subtitle,
  onMenuClick,
}: HeaderProps) {
  const router = useRouter()
  const { user } = useAuthStore()

  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useHydrated()
  const { toggleShortcutsModal } = useUIStore()
  const [resendCooldown, setResendCooldown] = useState(0)
  const [isResending, setIsResending] = useState(false)

  // Cooldown timer para reenvío de correo
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  const isDark = resolvedTheme === "dark"

  // Resend verification email
  const handleResendVerificationEmail = async () => {
    setIsResending(true)
    try {
      const response = await fetch("/api/auth/resend-verification-email", {
        method: "POST",
      })
      if (response.ok) {
        setResendCooldown(60)
      }
    } catch (error) {
      console.error("Error resending verification email:", error)
    } finally {
      setIsResending(false)
    }
  }

  // Build notifications array based on user state
  const notifications: NotificationItem[] = []

  if (user && !user.emailVerified) {
    notifications.push({
      id: "verify-email",
      type: "warning",
      title: "Verificá tu correo electrónico",
      description:
        "Necesitamos confirmar tu dirección de correo para proteger tu cuenta.",
      createdAt: "Pendiente",
      unread: true,
      actionLabel: "Verificar correo",
      onAction: () => {
        router.push("/auth/verify-email")
      },
      dismissible: false,
    })
  }

  return (
    <header className={styles.header}>
      <div className={styles.titleSection}>
        {onMenuClick && (
          <button
            className={styles.menuButton}
            onClick={onMenuClick}
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
        )}

        <div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && (
            <p className={styles.subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.iconButton}
          onClick={toggleShortcutsModal}
          aria-label="Atajos de teclado"
          title="Atajos de teclado (Ctrl + ?)"
        >
          <Keyboard size={18} />
        </button>

        <button
          className={styles.iconButton}
          onClick={toggleTheme}
          aria-label={
            isDark
              ? "Cambiar a modo claro"
              : "Cambiar a modo oscuro"
          }
          title={
            isDark
              ? "Modo claro"
              : "Modo oscuro"
          }
          disabled={!mounted}
        >
          {!mounted ? (
            <span
              style={{
                width: 18,
                height: 18,
                display: "block",
              }}
            />
          ) : isDark ? (
            <Sun size={18} />
          ) : (
            <Moon size={18} />
          )}
        </button>

        <NotificationsDropdown notifications={notifications} />

        <button className={styles.userButton}>
          <div className={styles.avatar}>
            {user?.name
              ?.charAt(0)
              .toUpperCase() || "U"}
          </div>
          <span className={styles.userName}>
            {user?.name || "Usuario"}
          </span>
        </button>
      </div>
    </header>
  )
}
