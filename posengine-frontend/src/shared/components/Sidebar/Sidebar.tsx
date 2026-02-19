"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ShoppingCart,
  Building2,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { BUSINESS_TYPES, type BusinessType } from "../../../../config/Businesstypes.config"
import styles from "./Sidebar.module.css"

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { tenant, logout } = useAuthStore()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  // Obtiene los módulos según el tipo de negocio del tenant
  // Si no tiene tipo asignado, usa los módulos de "tienda" por defecto
  const tenantType = (tenant as any)?.type as BusinessType | undefined
  const navItems = tenantType && BUSINESS_TYPES[tenantType]
    ? BUSINESS_TYPES[tenantType].modules
    : BUSINESS_TYPES["tienda"].modules

  const businessTypeLabel = tenantType && BUSINESS_TYPES[tenantType]
    ? BUSINESS_TYPES[tenantType].label
    : "Negocio"

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ""}`}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <ShoppingCart size={20} />
          </div>
          {!isCollapsed && <span className={styles.logoText}>POSENGINE</span>}
        </div>
        <button
          className={styles.collapseButton}
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expandir" : "Colapsar"}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={20} className={styles.navIcon} />
                  {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={styles.footer}>
        {!isCollapsed && (
          <div className={styles.tenantInfo}>
            <div className={styles.tenantIcon}>
              <Building2 size={16} />
            </div>
            <div className={styles.tenantDetails}>
              <p className={styles.tenantName}>{tenant?.name || "Mi Tienda"}</p>
              <p className={styles.tenantPlan}>{businessTypeLabel}</p>
            </div>
          </div>
        )}
        <button className={styles.logoutButton} onClick={handleLogout}>
          <LogOut size={18} />
          {!isCollapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}