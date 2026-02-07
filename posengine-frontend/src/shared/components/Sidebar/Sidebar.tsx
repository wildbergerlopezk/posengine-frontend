"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FolderTree,
  Warehouse,
  BarChart3,
  Building2,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import styles from "./Sidebar.module.css"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/sales", label: "Ventas", icon: ShoppingCart },
  { href: "/dashboard/products", label: "Productos", icon: Package },
  { href: "/dashboard/categories", label: "Categorías", icon: FolderTree },
  { href: "/dashboard/stock", label: "Stock", icon: Warehouse },
  { href: "/dashboard/reports", label: "Reportes", icon: BarChart3 },
  { href: "/dashboard/business", label: "Mi Negocio", icon: Building2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { tenant, logout } = useAuthStore()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

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
              <p className={styles.tenantPlan}>Plan Pro</p>
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
