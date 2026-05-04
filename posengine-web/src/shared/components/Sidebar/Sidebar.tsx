"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck,
  Wallet, BarChart2, Printer, Settings, ShoppingBag, History,
  PlusCircle, List, Tags, Tag, Building2, LogOut, Menu,
  ChevronDown, ChevronRight, RotateCcw
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import styles from "./Sidebar.module.css"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },

  {
    href: "/dashboard/sales",
    label: "Ventas",
    icon: ShoppingCart,
    subItems: [
      { href: "/dashboard/sales/pos", label: "Nueva venta", icon: PlusCircle },
      { href: "/dashboard/sales/history", label: "Historial de ventas", icon: History },
    ],
  },

  {
    href: "/dashboard/products",
    label: "Inventario",
    icon: Package,
    subItems: [
      { href: "/dashboard/products", label: "Productos", icon: List },
      { href: "/dashboard/stock/history", label: "Historial de stock", icon: History },
      { href: "/dashboard/categories", label: "Categorías", icon: Tags },
      { href: "/dashboard/subcategories", label: "Subcategorías", icon: Tag },
    ],
  },

  {
    href: "/dashboard/purchases",
    label: "Compras",
    icon: ShoppingBag,
    subItems: [
      { href: "/dashboard/purchases/new", label: "Registrar compra", icon: PlusCircle },
      { href: "/dashboard/purchases/history", label: "Historial de compras", icon: History },
    ],
  },

  {
    href: "/dashboard/clients",
    label: "Clientes",
    icon: Users,
    subItems: [
      { href: "/dashboard/clients", label: "Lista de clientes", icon: List },
      { href: "/dashboard/clients/payments", label: "Pagos de deuda", icon: Wallet },
    ],
  },

  { href: "/dashboard/suppliers", label: "Proveedores", icon: Truck },

  {
    href: "/dashboard/cash",
    label: "Caja",
    icon: Wallet,
  },

  { href: "/dashboard/reports", label: "Reportes", icon: BarChart2 },

  {
    href: "/dashboard/printing",
    label: "Impresión",
    icon: Printer,
    subItems: [
      { href: "/dashboard/printing/invoices", label: "Facturas", icon: List },
      { href: "/dashboard/printing/labels", label: "Etiquetas", icon: Tag },
    ],
  },
]

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

  const closeSidebar = () => setIsOpen(false)
  const toggleSidebar = () => setIsOpen((prev) => !prev)

  // --- FIX: Identificar rutas que ya están "cubiertas" por un subitem ---
  // Esto evita que un item raíz se marque como activo si su href coincide con
  // el href de un subitem que ya pertenece a un grupo padre expandible.
  const subItemHrefs = new Set(
    navItems.flatMap(item => item.subItems?.map(s => s.href) ?? [])
  )
  // ------------------------------------------------------------------------

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
                    // --- FIX: Aplicar lógica de activación segura ---
                    // El item raíz solo se marca activo si:
                    // 1. La ruta coincide exactamente (pathname === item.href)
                    // 2. Y esa ruta NO está registrada como subItem de otro grupo (!subItemHrefs.has(item.href))
                    className={`${styles.navItem} ${
                      pathname === item.href && !subItemHrefs.has(item.href) 
                        ? styles.active 
                        : ""
                    }`}
                    // -------------------------------------------------
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
                  <p className={styles.tenantPlan}>Plan Estándar</p>
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
