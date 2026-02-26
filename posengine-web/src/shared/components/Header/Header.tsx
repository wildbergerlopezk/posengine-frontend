"use client"

import { useState, useEffect } from "react"
import { Search, Bell, Sun, Moon, Menu } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
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
  const { user } = useAuthStore()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  const isDark = resolvedTheme === "dark"

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

        <button
          className={styles.iconButton}
          aria-label="Notificaciones"
        >
          <Bell size={18} />
        </button>

        <button className={styles.userButton}>
          <div className={styles.avatar}>
            {user?.fullName
              ?.charAt(0)
              .toUpperCase() || "U"}
          </div>
          <span className={styles.userName}>
            {user?.fullName || "Usuario"}
          </span>
        </button>
      </div>
    </header>
  )
}
