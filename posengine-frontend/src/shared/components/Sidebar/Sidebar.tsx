"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Settings, Building2, LogOut, Menu } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { BUSINESS_TYPES, DEFAULT_BUSINESS_TYPE_MODULES, type BusinessType } from "../../../../config/Businesstypes.config"
import styles from "./Sidebar.module.css"

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { tenant, logout } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const tenantType = tenant?.type as BusinessType | undefined
  const navItems = tenantType && BUSINESS_TYPES[tenantType]
    ? BUSINESS_TYPES[tenantType].modules
    : DEFAULT_BUSINESS_TYPE_MODULES

  const businessTypeLabel = tenantType && BUSINESS_TYPES[tenantType]
    ? BUSINESS_TYPES[tenantType].label
    : "Negocio"

  const closeSidebar = () => setIsOpen(false)
  const toggleSidebar = () => setIsOpen((prev) => !prev)

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={closeSidebar} />}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.sidebarHeader}>
          <button className={styles.menuButton} onClick={toggleSidebar} aria-label="Toggle menú">
            <Menu size={24} />
          </button>
          {isOpen && (
            <div className={styles.logo}>
              <div className={styles.logoIcon}>
                <Settings size={18} />
              </div>
              <span className={styles.logoText}>POSENGINE</span>
            </div>
          )}
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={`${styles.navItem} ${isActive ? styles.active : ""}`}
                title={!isOpen ? item.label : undefined}
              >
                <Icon size={20} />
                {isOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className={styles.footer}>
          {isOpen ? (
            <>
              <div className={styles.tenantInfo}>
                <div className={styles.tenantIcon}>
                  <Building2 size={16} />
                </div>
                <div className={styles.tenantDetails}>
                  <p className={styles.tenantName}>{tenant?.name || "Mi Negocio"}</p>
                  <p className={styles.tenantPlan}>{businessTypeLabel}</p>
                </div>
              </div>
              <button className={styles.logoutButton} onClick={handleLogout}>
                <LogOut size={18} />
                <span>Cerrar sesión</span>
              </button>
            </>
          ) : (
            <button
              className={styles.logoutButtonCollapsed}
              onClick={handleLogout}
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>
    </>
  )
}