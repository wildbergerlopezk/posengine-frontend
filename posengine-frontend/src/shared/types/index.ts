// Multi-tenant types
export interface Tenant {
  id: string
  name: string
  slug: string
  logo?: string
  address?: string
  phone?: string
  email?: string
  currency: string
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  email: string
  name: string
  role: "owner" | "admin" | "cashier"
  tenantId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Category {
  id: string
  tenantId: string
  name: string
  parentId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Product {
  id: string
  tenantId: string
  name: string
  description?: string
  barcode?: string
  sku?: string
  categoryId?: string
  subcategoryId?: string
  purchasePrice: number
  salePrice: number
  stock: number
  minStock: number
  image?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface Sale {
  id: string
  tenantId: string
  userId: string
  items: SaleItem[]
  subtotal: number
  tax: number
  total: number
  paymentMethod: "cash" | "card" | "transfer"
  status: "completed" | "cancelled" | "pending"
  createdAt: Date
}

export interface SaleItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
}

export interface DashboardStats {
  todaySales: number
  todayRevenue: number
  weekRevenue: number
  monthRevenue: number
  lowStockProducts: number
  totalProducts: number
}
