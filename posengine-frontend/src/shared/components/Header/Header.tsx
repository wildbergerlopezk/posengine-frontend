"use client"

import { Search, Bell } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import styles from "./Header.module.css"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuthStore()

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

        <button className={styles.userButton}>
          <Bell size={20} />
        </button>

        <button className={styles.userButton}>
          <div className={styles.avatar}>{user?.name?.charAt(0).toUpperCase() || "U"}</div>
          <span className={styles.userName}>{user?.name || "Usuario"}</span>
        </button>
      </div>
    </header>
  )
}
