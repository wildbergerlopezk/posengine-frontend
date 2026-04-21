export interface Category {
  id: string
  tenantId: string
  name: string
  parentId?: string
  subcategories?: Category[]
  createdAt: Date
  updatedAt: Date
}

export interface Subcategory {
  id: string
  tenantId: string
  name: string
  categoryId: string
  category?: Category
  createdAt: Date
  updatedAt: Date
}

export interface Supplier {
  id: string
  tenantId: string
  name: string
  address?: string | null
  phone?: string | null
  RUC?: string | null
  createdAt: string
  updatedAt: string
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
  cost?: number
  price: number
  stock: number
  stockMinimum: number
  imageUrl?: string
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
  tenantId: number
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
