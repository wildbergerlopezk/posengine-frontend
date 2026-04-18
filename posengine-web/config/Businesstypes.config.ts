import {
  LayoutDashboard, ShoppingCart, Package, FolderTree, Warehouse,
  BarChart3, Building2, Users, Truck, CalendarDays, Stethoscope,
  UtensilsCrossed, BedDouble, Wine, Scissors, Wrench, Pill,
  Dumbbell, Coffee, Scale, Dog, HardHat, Home, Calculator,
  BookOpen, Monitor, Car, History, ArrowLeftRight, ShoppingBag,
  Banknote, Vault, Printer, FileText, PlusCircle, Tags, type LucideIcon,
} from "lucide-react"

export interface NavModule {
  href: string
  label: string
  icon: LucideIcon
  subItems?: NavModule[]
}

export type BusinessType =
  | "Bakery"
  | "AutoRepair"
  | "Hotel"
  | "HardwareStore"
  | "Pharmacy"
  | "Restaurant"
  | "Gym"
  | "MedicalClinic"
  | "ClothingStore"
  | "Supermarket"
  | "Veterinary"
  | "BeautySalon"
  | "CoffeeShop"
  | "LawFirm"
  | "Construction"
  | "RealEstate"
  | "AccountingFirm"
  | "LanguageSchool"
  | "ITServices"
  | "AutoParts"

export interface BusinessTypeConfig {
  label: string
  description: string
  icon: LucideIcon
  modules: NavModule[]
}

// ─── Módulos reutilizables ─────────────────────────────────────────────────────
const MOD_DASHBOARD: NavModule = { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }

const MOD_POS_VENTAS: NavModule = {
  href: "/dashboard/sales",
  label: "Ventas",
  icon: ShoppingCart,
  subItems: [
    { href: "/dashboard/sales", label: "Caja", icon: ShoppingCart },
    { href: "/dashboard/sales/history", label: "Historial de ventas", icon: History },
    { href: "/dashboard/sales/returns", label: "Devoluciones", icon: ArrowLeftRight },
  ]
}

const MOD_POS_INVENTARIO: NavModule = {
  href: "/dashboard/inventory",
  label: "Inventario",
  icon: Package,
  subItems: [
    { href: "/dashboard/products", label: "Productos", icon: Package },
    { href: "/dashboard/categories", label: "Categorías", icon: FolderTree },
    { href: "/dashboard/inventory/subcategories", label: "Subcategorías", icon: Tags },
  ]
}

const MOD_POS_COMPRAS: NavModule = {
  href: "/dashboard/purchases",
  label: "Compras",
  icon: ShoppingBag,
  subItems: [
    { href: "/dashboard/purchases/new", label: "Registrar compra", icon: PlusCircle },
    { href: "/dashboard/purchases/history", label: "Historial de compras", icon: History },
  ]
}

const MOD_POS_CLIENTES: NavModule = {
  href: "/dashboard/clients",
  label: "Clientes",
  icon: Users,
  subItems: [
    { href: "/dashboard/clients", label: "Lista de clientes", icon: Users },
    { href: "/dashboard/clients/payments", label: "Pagos de deuda", icon: Banknote },
  ]
}

const MOD_POS_PROVEEDORES: NavModule = {
  href: "/dashboard/suppliers",
  label: "Proveedores",
  icon: Truck,
}

const MOD_POS_CAJA: NavModule = {
  href: "/dashboard/cash",
  label: "Caja",
  icon: Vault,
}

const MOD_POS_REPORTES: NavModule = {
  href: "/dashboard/reports",
  label: "Reportes",
  icon: BarChart3,
}

const MOD_POS_IMPRESION: NavModule = {
  href: "/dashboard/printing",
  label: "Impresión",
  icon: Printer,
  subItems: [
    { href: "/dashboard/printing/invoices", label: "Facturas", icon: FileText },
  ]
}

// Legacy modules for compatibility
const MOD_VENTAS: NavModule = MOD_POS_VENTAS
const MOD_PRODUCTOS: NavModule = { href: "/dashboard/products", label: "Productos", icon: Package }
const MOD_CATEGORIAS: NavModule = { href: "/dashboard/categories", label: "Categorías", icon: FolderTree }
const MOD_STOCK: NavModule = { href: "/dashboard/stock", label: "Stock", icon: Warehouse }
const MOD_REPORTES: NavModule = MOD_POS_REPORTES
const MOD_NEGOCIO: NavModule = { href: "/dashboard/business", label: "Mi Negocio", icon: Building2 }
const MOD_CLIENTES: NavModule = MOD_POS_CLIENTES
const MOD_PROVEEDORES: NavModule = MOD_POS_PROVEEDORES
const MOD_CITAS: NavModule = { href: "/dashboard/appointments", label: "Citas", icon: CalendarDays }
const MOD_PACIENTES: NavModule = { href: "/dashboard/patients", label: "Pacientes", icon: Stethoscope }
const MOD_MESAS: NavModule = { href: "/dashboard/tables", label: "Mesas", icon: UtensilsCrossed }
const MOD_HABITACIONES: NavModule = { href: "/dashboard/rooms", label: "Habitaciones", icon: BedDouble }
const MOD_RESERVAS: NavModule = { href: "/dashboard/reservations", label: "Reservas", icon: CalendarDays }
const MOD_BEBIDAS: NavModule = { href: "/dashboard/drinks", label: "Carta/Bebidas", icon: Wine }
const MOD_SERVICIOS: NavModule = { href: "/dashboard/services", label: "Servicios", icon: Scissors }
const MOD_RECETAS: NavModule = { href: "/dashboard/recipes", label: "Recetas", icon: Package }
const MOD_PRODUCCION: NavModule = { href: "/dashboard/production", label: "Producción", icon: Wrench }
const MOD_MEMBRESIAS: NavModule = { href: "/dashboard/memberships", label: "Membresías", icon: Users }
const MOD_EXPEDIENTES: NavModule = { href: "/dashboard/cases", label: "Expedientes", icon: Scale }
const MOD_PROYECTOS: NavModule = { href: "/dashboard/projects", label: "Proyectos", icon: HardHat }
const MOD_PROPIEDADES: NavModule = { href: "/dashboard/properties", label: "Propiedades", icon: Home }
const MOD_TICKETS: NavModule = { href: "/dashboard/tickets", label: "Tickets", icon: Monitor }
const MOD_ALUMNOS: NavModule = { href: "/dashboard/students", label: "Alumnos", icon: BookOpen }
const MOD_CURSOS: NavModule = { href: "/dashboard/courses", label: "Cursos", icon: BookOpen }

export const DEFAULT_BUSINESS_TYPE_MODULES: NavModule[] = [
  MOD_DASHBOARD,
  MOD_POS_VENTAS,
  MOD_POS_INVENTARIO,
  MOD_POS_COMPRAS,
  MOD_POS_CLIENTES,
  MOD_POS_PROVEEDORES,
  MOD_POS_CAJA,
  MOD_POS_REPORTES,
  MOD_POS_IMPRESION,
]
// ─── Configuración por tipo de negocio ────────────────────────────────────────
export const BUSINESS_TYPES: Record<BusinessType, BusinessTypeConfig> = {
  Bakery: {
    label: "Panadería",
    description: "Gestión de producción artesanal, recetas y venta al mostrador.",
    icon: Package,
    modules: [MOD_DASHBOARD, MOD_VENTAS, MOD_PRODUCCION, MOD_RECETAS, MOD_STOCK, MOD_PROVEEDORES, MOD_REPORTES, MOD_NEGOCIO],
  },
  AutoRepair: {
    label: "Taller Mecánico",
    description: "Control de órdenes de servicio, repuestos y mano de obra.",
    icon: Wrench,
    modules: [MOD_DASHBOARD, MOD_VENTAS, MOD_PRODUCTOS, MOD_STOCK, MOD_CLIENTES, MOD_PROVEEDORES, MOD_REPORTES, MOD_NEGOCIO],
  },
  Hotel: {
    label: "Hotel",
    description: "Administración de reservas, disponibilidad de habitaciones y limpieza.",
    icon: BedDouble,
    modules: [MOD_DASHBOARD, MOD_RESERVAS, MOD_HABITACIONES, MOD_CLIENTES, MOD_VENTAS, MOD_STOCK, MOD_PROVEEDORES, MOD_REPORTES, MOD_NEGOCIO],
  },
  HardwareStore: {
    label: "Ferretería",
    description: "Venta mayorista/minorista de herramientas y materiales de construcción.",
    icon: Wrench,
    modules: [MOD_DASHBOARD, MOD_VENTAS, MOD_PRODUCTOS, MOD_CATEGORIAS, MOD_STOCK, MOD_CLIENTES, MOD_PROVEEDORES, MOD_REPORTES, MOD_NEGOCIO],
  },
  Pharmacy: {
    label: "Farmacia",
    description: "Control estricto de lotes, vencimientos y trazabilidad médica.",
    icon: Pill,
    modules: [MOD_DASHBOARD, MOD_VENTAS, MOD_PRODUCTOS, MOD_STOCK, MOD_CLIENTES, MOD_PROVEEDORES, MOD_REPORTES, MOD_NEGOCIO],
  },
  Restaurant: {
    label: "Restaurante",
    description: "Gestión de mesas, comandería para cocina y menú digital.",
    icon: UtensilsCrossed,
    modules: [MOD_DASHBOARD, MOD_VENTAS, MOD_MESAS, MOD_PRODUCTOS, MOD_CATEGORIAS, MOD_STOCK, MOD_PROVEEDORES, MOD_REPORTES, MOD_NEGOCIO],
  },
  Gym: {
    label: "Gimnasio",
    description: "Control de membresías, acceso de socios y planes de entrenamiento.",
    icon: Dumbbell,
    modules: [MOD_DASHBOARD, MOD_MEMBRESIAS, MOD_CLIENTES, MOD_VENTAS, MOD_PRODUCTOS, MOD_REPORTES, MOD_NEGOCIO],
  },
  MedicalClinic: {
    label: "Clínica Médica",
    description: "Agenda de turnos, expedientes de pacientes y triaje.",
    icon: Stethoscope,
    modules: [MOD_DASHBOARD, MOD_CITAS, MOD_PACIENTES, MOD_CLIENTES, MOD_PRODUCTOS, MOD_STOCK, MOD_REPORTES, MOD_NEGOCIO],
  },
  ClothingStore: {
    label: "Tienda de Ropa",
    description: "Gestión de tallas, colores y catálogos de temporada.",
    icon: ShoppingCart,
    modules: [MOD_DASHBOARD, MOD_VENTAS, MOD_PRODUCTOS, MOD_CATEGORIAS, MOD_STOCK, MOD_CLIENTES, MOD_PROVEEDORES, MOD_REPORTES, MOD_NEGOCIO],
  },
  Supermarket: {
    label: "Supermercado",
    description: "Ventas masivas, control de balanzas y programas de lealtad.",
    icon: ShoppingCart,
    modules: [MOD_DASHBOARD, MOD_VENTAS, MOD_PRODUCTOS, MOD_CATEGORIAS, MOD_STOCK, MOD_CLIENTES, MOD_PROVEEDORES, MOD_REPORTES, MOD_NEGOCIO],
  },
  Veterinary: {
    label: "Veterinaria",
    description: "Historial clínico de mascotas, vacunas y cirugías.",
    icon: Dog,
    modules: [MOD_DASHBOARD, MOD_CITAS, MOD_PACIENTES, MOD_CLIENTES, MOD_PRODUCTOS, MOD_STOCK, MOD_PROVEEDORES, MOD_VENTAS, MOD_REPORTES, MOD_NEGOCIO],
  },
  BeautySalon: {
    label: "Estética / Peluquería",
    description: "Agenda de servicios de belleza y comisiones para estilistas.",
    icon: Scissors,
    modules: [MOD_DASHBOARD, MOD_CITAS, MOD_CLIENTES, MOD_SERVICIOS, MOD_PRODUCTOS, MOD_STOCK, MOD_VENTAS, MOD_REPORTES, MOD_NEGOCIO],
  },
  CoffeeShop: {
    label: "Cafetería",
    description: "Punto de venta rápido para bebidas, insumos y barismo.",
    icon: Coffee,
    modules: [MOD_DASHBOARD, MOD_VENTAS, MOD_BEBIDAS, MOD_PRODUCTOS, MOD_STOCK, MOD_PROVEEDORES, MOD_REPORTES, MOD_NEGOCIO],
  },
  LawFirm: {
    label: "Bufete de Abogados",
    description: "Seguimiento de expedientes judiciales y plazos legales.",
    icon: Scale,
    modules: [MOD_DASHBOARD, MOD_EXPEDIENTES, MOD_CLIENTES, MOD_REPORTES, MOD_NEGOCIO],
  },
  Construction: {
    label: "Constructora",
    description: "Gestión de proyectos de obra, maquinaria y presupuestos.",
    icon: HardHat,
    modules: [MOD_DASHBOARD, MOD_PROYECTOS, MOD_PRODUCTOS, MOD_STOCK, MOD_PROVEEDORES, MOD_CLIENTES, MOD_REPORTES, MOD_NEGOCIO],
  },
  RealEstate: {
    label: "Inmobiliaria",
    description: "Administración de propiedades, contratos de alquiler y visitas.",
    icon: Home,
    modules: [MOD_DASHBOARD, MOD_PROPIEDADES, MOD_CLIENTES, MOD_CITAS, MOD_REPORTES, MOD_NEGOCIO],
  },
  AccountingFirm: {
    label: "Estudio Contable",
    description: "Auditoría, declaración de impuestos y gestión de documentos fiscales.",
    icon: Calculator,
    modules: [MOD_DASHBOARD, MOD_CLIENTES, MOD_REPORTES, MOD_NEGOCIO],
  },
  LanguageSchool: {
    label: "Academia de Idiomas",
    description: "Matriculación de alumnos, cursos y seguimiento de exámenes.",
    icon: BookOpen,
    modules: [MOD_DASHBOARD, MOD_ALUMNOS, MOD_CURSOS, MOD_CITAS, MOD_REPORTES, MOD_NEGOCIO],
  },
  ITServices: {
    label: "Servicios IT",
    description: "Mesa de ayuda, tickets de soporte y gestión de proyectos tecnológicos.",
    icon: Monitor,
    modules: [MOD_DASHBOARD, MOD_TICKETS, MOD_PROYECTOS, MOD_CLIENTES, MOD_REPORTES, MOD_NEGOCIO],
  },
  AutoParts: {
    label: "Venta de Repuestos",
    description: "Catálogo técnico de piezas, compatibilidad por marca y almacén.",
    icon: Car,
    modules: [MOD_DASHBOARD, MOD_VENTAS, MOD_PRODUCTOS, MOD_CATEGORIAS, MOD_STOCK, MOD_CLIENTES, MOD_PROVEEDORES, MOD_REPORTES, MOD_NEGOCIO],
  },
}