import type { Product } from "@/src/shared/types"

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL

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

export interface Category {
  id: string
  name: string
  tenantId: string
}

export async function getDashboardData(accessToken: string): Promise<DashboardDataResponse> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  try {
    // Fetch sales data for the current month
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0]
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0]

    // Fetch data with error handling for each endpoint
    let sales: any[] = []
    let products: Product[] = []
    let categories: Category[] = []

    // Fetch sales
    try {
      const salesResponse = await fetch(`${API_BASE}/sales?limit=100&dateFrom=${monthStart}&dateTo=${monthEnd}`, {
        headers,
      })
      if (salesResponse.ok) {
        const salesData = await salesResponse.json()
        sales = salesData.items || salesData || []
      } else {
        console.warn("Failed to fetch sales:", salesResponse.status)
      }
    } catch (err) {
      console.warn("Error fetching sales:", err)
    }

    // Fetch products
    try {
      let productsResponse = await fetch(`${API_BASE}/product`, { headers })
      if (!productsResponse.ok && productsResponse.status === 400) {
        // Try with query parameters in case that was the issue
        productsResponse = await fetch(`${API_BASE}/product?skip=0&take=1000`, { headers })
      }
      if (productsResponse.ok) {
        const productsData = await productsResponse.json()
        products = productsData.items || productsData || []
      } else {
        console.warn("Failed to fetch products:", productsResponse.status)
        // Try alternative endpoint
        try {
          const altResponse = await fetch(`${API_BASE}/products`, { headers })
          if (altResponse.ok) {
            const altData = await altResponse.json()
            products = altData.items || altData || []
          }
        } catch (err) {
          console.warn("Alternative products endpoint also failed:", err)
        }
      }
    } catch (err) {
      console.warn("Error fetching products:", err)
    }

    // Fetch categories
    try {
      const categoriesResponse = await fetch(`${API_BASE}/categories?limit=100`, { headers })
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json()
        categories = categoriesData.items || categoriesData || []
      } else {
        console.warn("Failed to fetch categories:", categoriesResponse.status)
      }
    } catch (err) {
      console.warn("Error fetching categories:", err)
    }

    // If we have no data at all, throw error
    if (sales.length === 0 && products.length === 0) {
      throw new Error("No se pudieron obtener datos del servidor. Verifica tu conexión.")
    }

    // Calculate dashboard stats
    const today_str = today.toISOString().split("T")[0]

    // Today's sales
    const todaySales = sales.filter(
      (s: any) => s.createdAt && s.createdAt.split("T")[0] === today_str && s.status !== "CANCELLED"
    )
    const todayRevenue = todaySales.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
    const todaySalesCount = todaySales.length

    // Month revenue
    const monthRevenue = sales
      .filter((s: any) => s.status !== "CANCELLED")
      .reduce((sum: number, s: any) => sum + (s.total || 0), 0)

    // Low stock products
    const lowStockProducts = products
      .filter((p: Product) => p.stock <= p.stockMinimum)
      .slice(0, 10)

    // Recent sales
    const recentSales = sales
      .filter((s: any) => s.status !== "CANCELLED")
      .sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime()
        const dateB = new Date(b.createdAt || 0).getTime()
        return dateB - dateA
      })
      .slice(0, 5)

    // Weekly sales data (last 7 days)
    const weeklySalesData = getWeeklySalesData(sales)

    // Category sales data
    const categorySalesData = getCategorySalesData(sales, products, categories)

    return {
      todaySales: todaySalesCount,
      todayRevenue,
      monthRevenue,
      lowStockProducts,
      recentSales,
      weeklySalesData,
      categorySalesData,
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
    throw error
  }
}

function getWeeklySalesData(sales: any[]): WeeklySalesData[] {
  const days = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
  const today = new Date()
  const weekData: { [key: number]: number } = {}

  // Initialize all days
  for (let i = 0; i < 7; i++) {
    weekData[i] = 0
  }

  // Populate data
  sales.forEach((sale: any) => {
    if (sale.status === "CANCELLED") return
    const saleDate = new Date(sale.createdAt)
    const dayOfWeek = saleDate.getDay() === 0 ? 6 : saleDate.getDay() - 1

    // Only count sales from the current week
    const diff = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 7) {
      weekData[dayOfWeek] = (weekData[dayOfWeek] || 0) + (sale.total || 0)
    }
  })

  return days.map((day, index) => ({
    name: day,
    ventas: weekData[index] || 0,
  }))
}

function getCategorySalesData(
  sales: any[],
  products: Product[],
  categories: Category[]
): CategorySalesData[] {
  const categoryMap: { [key: string]: { name: string; count: number } } = {}

  // Create a map of categories by ID for faster lookup
  const categoryMap_ = new Map(categories.map((c: Category) => [c.id, c.name]))

  sales.forEach((sale: any) => {
    if (sale.status === "CANCELLED") return
    sale.items?.forEach((item: any) => {
      const product = products.find((p: Product) => p.id === item.productId)
      if (product?.categoryId) {
        const categoryName = categoryMap_.get(product.categoryId) || "Sin categoría"
        if (!categoryMap[product.categoryId]) {
          categoryMap[product.categoryId] = { name: categoryName, count: 0 }
        }
        categoryMap[product.categoryId].count += item.quantity
      }
    })
  })

  return Object.values(categoryMap)
    .map((cat) => ({
      name: cat.name,
      ventas: cat.count,
    }))
    .sort((a, b) => b.ventas - a.ventas)
    .slice(0, 5)
}
