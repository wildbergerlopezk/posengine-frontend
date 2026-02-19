/**
 * Configuración de tipos de negocio y sus módulos disponibles
 * Agrega o quita tipos/módulos según necesites
 */

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FolderTree,
  Warehouse,
  BarChart3,
  Building2,
  Users,
  Truck,
  CalendarDays,
  Stethoscope,
  UtensilsCrossed,
  BedDouble,
  Wine,
  Scissors,
  type LucideIcon,
} from "lucide-react"

export interface NavModule {
  href: string
  label: string
  icon: LucideIcon
}

export type BusinessType =
  | "tienda"
  | "veterinaria"
  | "restaurante"
  | "hotel"
  | "bar"
  | "salon"

export interface BusinessTypeConfig {
  label: string
  description: string
  icon: LucideIcon
  modules: NavModule[]
}

// ─── Módulos reutilizables ─────────────────────────────────────────────────────
const MOD_DASHBOARD:   NavModule = { href: "/dashboard",            label: "Dashboard",    icon: LayoutDashboard  }
const MOD_VENTAS:      NavModule = { href: "/dashboard/sales",      label: "Ventas",       icon: ShoppingCart     }
const MOD_PRODUCTOS:   NavModule = { href: "/dashboard/products",   label: "Productos",    icon: Package          }
const MOD_CATEGORIAS:  NavModule = { href: "/dashboard/categories", label: "Categorías",   icon: FolderTree       }
const MOD_STOCK:       NavModule = { href: "/dashboard/stock",      label: "Stock",        icon: Warehouse        }
const MOD_REPORTES:    NavModule = { href: "/dashboard/reports",    label: "Reportes",     icon: BarChart3        }
const MOD_NEGOCIO:     NavModule = { href: "/dashboard/business",   label: "Mi Negocio",   icon: Building2        }
const MOD_CLIENTES:    NavModule = { href: "/dashboard/clients",    label: "Clientes",     icon: Users            }
const MOD_PROVEEDORES: NavModule = { href: "/dashboard/suppliers",  label: "Proveedores",  icon: Truck            }
const MOD_CITAS:       NavModule = { href: "/dashboard/appointments", label: "Citas",      icon: CalendarDays     }
const MOD_PACIENTES:   NavModule = { href: "/dashboard/patients",   label: "Pacientes",    icon: Stethoscope      }
const MOD_MESAS:       NavModule = { href: "/dashboard/tables",     label: "Mesas",        icon: UtensilsCrossed  }
const MOD_HABITACIONES:NavModule = { href: "/dashboard/rooms",      label: "Habitaciones", icon: BedDouble        }
const MOD_RESERVAS:    NavModule = { href: "/dashboard/reservations", label: "Reservas",   icon: CalendarDays     }
const MOD_BEBIDAS:     NavModule = { href: "/dashboard/drinks",     label: "Carta/Bebidas",icon: Wine             }
const MOD_SERVICIOS:   NavModule = { href: "/dashboard/services",   label: "Servicios",    icon: Scissors         }

// ─── Configuración por tipo de negocio ────────────────────────────────────────
export const BUSINESS_TYPES: Record<BusinessType, BusinessTypeConfig> = {
  tienda: {
    label: "Tienda / Retail",
    description: "Venta de productos al público general",
    icon: ShoppingCart,
    modules: [
      MOD_DASHBOARD,
      MOD_VENTAS,
      MOD_PRODUCTOS,
      MOD_CATEGORIAS,
      MOD_STOCK,
      MOD_CLIENTES,
      MOD_PROVEEDORES,
      MOD_REPORTES,
      MOD_NEGOCIO,
    ],
  },

  veterinaria: {
    label: "Veterinaria",
    description: "Clínica veterinaria y venta de productos para mascotas",
    icon: Stethoscope,
    modules: [
      MOD_DASHBOARD,
      MOD_CITAS,
      MOD_PACIENTES,
      MOD_CLIENTES,
      MOD_PRODUCTOS,
      MOD_STOCK,
      MOD_PROVEEDORES,
      MOD_VENTAS,
      MOD_REPORTES,
      MOD_NEGOCIO,
    ],
  },

  restaurante: {
    label: "Restaurante",
    description: "Restaurante, cafetería o comida para llevar",
    icon: UtensilsCrossed,
    modules: [
      MOD_DASHBOARD,
      MOD_VENTAS,
      MOD_MESAS,
      MOD_PRODUCTOS,
      MOD_CATEGORIAS,
      MOD_STOCK,
      MOD_PROVEEDORES,
      MOD_REPORTES,
      MOD_NEGOCIO,
    ],
  },

  hotel: {
    label: "Hotel / Hospedaje",
    description: "Hotel, hostal o alojamiento turístico",
    icon: BedDouble,
    modules: [
      MOD_DASHBOARD,
      MOD_RESERVAS,
      MOD_HABITACIONES,
      MOD_CLIENTES,
      MOD_VENTAS,
      MOD_PRODUCTOS,
      MOD_STOCK,
      MOD_PROVEEDORES,
      MOD_REPORTES,
      MOD_NEGOCIO,
    ],
  },

  bar: {
    label: "Bar / Cantina",
    description: "Bar, pub o cantina con venta de bebidas",
    icon: Wine,
    modules: [
      MOD_DASHBOARD,
      MOD_VENTAS,
      MOD_MESAS,
      MOD_BEBIDAS,
      MOD_STOCK,
      MOD_PROVEEDORES,
      MOD_REPORTES,
      MOD_NEGOCIO,
    ],
  },

  salon: {
    label: "Salón de belleza",
    description: "Peluquería, barbería o centro de estética",
    icon: Scissors,
    modules: [
      MOD_DASHBOARD,
      MOD_CITAS,
      MOD_CLIENTES,
      MOD_SERVICIOS,
      MOD_PRODUCTOS,
      MOD_STOCK,
      MOD_VENTAS,
      MOD_REPORTES,
      MOD_NEGOCIO,
    ],
  },
}