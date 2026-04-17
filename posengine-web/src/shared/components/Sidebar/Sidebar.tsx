"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Settings, Building2, LogOut, Menu, ChevronDown, ChevronRight } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { BUSINESS_TYPES, DEFAULT_BUSINESS_TYPE_MODULES, type BusinessType } from "../../../../config/Businesstypes.config"
import styles from "./Sidebar.module.css"

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpand = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    )
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  // derive business type from user if available, otherwise use default
  // note: tenant type logic can be updated here if user object contains it
  const tenantType = undefined as BusinessType | undefined
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
            const hasSubItems = item.subItems && item.subItems.length > 0
            const isExpanded = expandedItems.includes(item.href)
            // A parent is considered active if any of its subItems is active or if its own href is active
            const isParentActive = pathname === item.href || (item.subItems?.some(sub => pathname === sub.href))
            const Icon = item.icon

            return (
              <div key={item.href} className={styles.navGroup}>
                {hasSubItems ? (
                  <>
                    <button
                      onClick={() => {
                        if (!isOpen) setIsOpen(true)
                        toggleExpand(item.href)
                      }}
                      className={`${styles.navItem} ${isParentActive ? styles.active : ""} ${hasSubItems ? styles.hasSubItems : ""}`}
                      title={!isOpen ? item.label : undefined}
                    >
                      <Icon size={20} />
                      {isOpen && (
                        <>
                          <span className={styles.label}>{item.label}</span>
                          <span className={styles.chevron}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </span>
                        </>
                      )}
                    </button>
                    {isOpen && isExpanded && (
                      <div className={styles.subMenu}>
                        {item.subItems?.map((subItem) => {
                          const isSubActive = pathname === subItem.href
                          const SubIcon = subItem.icon
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              onClick={closeSidebar}
                              className={`${styles.subNavItem} ${isSubActive ? styles.activeSub : ""}`}
                            >
                              <SubIcon size={18} />
                              <span>{subItem.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeSidebar}
                    className={`${styles.navItem} ${pathname === item.href ? styles.active : ""}`}
                    title={!isOpen ? item.label : undefined}
                  >
                    <Icon size={20} />
                    {isOpen && <span>{item.label}</span>}
                  </Link>
                )}
              </div>
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
                  <p className={styles.tenantName}>{user?.tenantName || "Mi Negocio"}</p>
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