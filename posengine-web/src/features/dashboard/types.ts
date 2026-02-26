export interface DashboardStats {
  todaySales: number
  todayRevenue: number
  weekRevenue: number
  monthRevenue: number
  lowStockProducts: number
  totalProducts: number
}

export interface SalesDataPoint {
  name: string
  ventas: number
}

export interface CategoryDataPoint {
  name: string
  ventas: number
}
