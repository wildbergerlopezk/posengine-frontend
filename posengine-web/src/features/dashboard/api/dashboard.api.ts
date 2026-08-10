import type { Product } from "@/src/shared/types"
import { API_BASE_URL } from "@/src/shared/config/api"

const API_BASE = API_BASE_URL

export interface DashboardDataResponse {
  todaySales: number
  todayRevenue: number
  monthRevenue: number
  lowStockProducts: Product[]
  recentSales: SaleData[]
  weeklySalesData: WeeklySalesData[]
  categorySalesData: CategorySalesData[]
}

export interface SaleData {
  id: string
  total: number
  paymentMethod: string
  status: string
  createdAt: string
  items: Array<{
    productId: string
    productName: string
    quantity: number
    unitPrice: number
  }>
}

export interface WeeklySalesData {
  day: string
  ventas: number
}

export interface CategorySalesData {
  name: string
  ventas: number
}

export async function getDashboardData(accessToken: string): Promise<DashboardDataResponse> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  const response = await fetch(`${API_BASE}/dashboard/stats`, {
    headers,
  })

  if (!response.ok) {
    throw new Error(`Error fetching dashboard statistics: ${response.statusText}`)
  }

  return response.json()
}

