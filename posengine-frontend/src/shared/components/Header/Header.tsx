"use client"

import { useState, useEffect } from "react"
import { Search, Bell, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import styles from "./Header.module.css"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuthStore()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Espera a que el componente monte en el cliente antes de mostrar el ícono
  // — sin esto, resolvedTheme es undefined en el primer render y el click no hace nada
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
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>

      <div className={styles.actions}>
        <div className={styles.searchContainer}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Buscar..." className={styles.searchInput} />
        </div>

        {/* Toggle de tema — solo renderiza el ícono correcto después de montar */}
        <button
          className={styles.iconButton}
          onClick={toggleTheme}
          aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          title={isDark ? "Modo claro" : "Modo oscuro"}
          disabled={!mounted}
        >
          {/* Mientras no está montado muestra un placeholder del mismo tamaño */}
          {!mounted
            ? <span style={{ width: 18, height: 18, display: "block" }} />
            : isDark
              ? <Sun size={18} />
              : <Moon size={18} />
          }
        </button>

        {/* Notificaciones */}
        <button className={styles.iconButton} aria-label="Notificaciones">
          <Bell size={18} />
        </button>

        {/* Usuario */}
        <button className={styles.userButton}>
          <div className={styles.avatar}>
            {user?.fullName?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className={styles.userName}>{user?.fullName || "Usuario"}</span>
        </button>
      </div>
    </header>
  )
}