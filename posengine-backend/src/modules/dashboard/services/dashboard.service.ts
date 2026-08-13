import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { Prisma } from '../../../generated/prisma/client'

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(tenantId: string) {
    const today = new Date()
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    // 1. Today's Revenue and Sales count
    const todaySalesAgg = await this.prisma.sale.aggregate({
      where: {
        tenantId,
        status: 'COMPLETED',
        saleDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        total: true,
      },
    })

    const todaySales = todaySalesAgg._count.id || 0
    const todayRevenue = todaySalesAgg._sum.total || 0

    // 2. Month Revenue
    const monthSalesAgg = await this.prisma.sale.aggregate({
      where: {
        tenantId,
        status: 'COMPLETED',
        saleDate: {
          gte: startOfMonth,
        },
      },
      _sum: {
        total: true,
      },
    })

    const monthRevenue = monthSalesAgg._sum.total || 0

    // 3. Low stock products (SQL query using $queryRaw to perform comparative filter on table columns)
    const lowStockProducts = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT id, name, sku, barcode, price, cost, stock, "stockMinimum"
      FROM products
      WHERE "tenantId" = ${tenantId}
        AND "isActive" = true
        AND stock <= "stockMinimum"
      LIMIT 10
    `)

    // 4. Recent sales (last 5)
    const recentSales = await this.prisma.sale.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
      },
      orderBy: {
        saleDate: 'desc',
      },
      take: 5,
      include: {
        items: {
          select: {
            productId: true,
            quantity: true,
            unitPrice: true,
            product: {
              select: { name: true },
            },
          },
        },
      },
    })

    // Map recent sales to match the frontend expects: { productId, productName, quantity, unitPrice }
    const mappedRecentSales = recentSales.map((sale) => ({
      id: sale.id,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      createdAt: sale.createdAt.toISOString(),
      items: sale.items.map((item) => ({
        productId: item.productId,
        productName: item.product?.name || 'Producto Desconocido',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    }))

    // 5. Weekly sales data
    const sevenDaysAgo = new Date(startOfToday)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const weeklySalesList = await this.prisma.sale.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        saleDate: { gte: sevenDaysAgo },
      },
      select: {
        saleDate: true,
        total: true,
      },
    })

    const weeklySalesData = this.calculateWeeklySales(
      weeklySalesList.map((s) => ({ ...s, total: Number(s.total) })),
    )

    // 6. Category sales data
    const categorySales = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          tenantId,
          status: 'COMPLETED',
          saleDate: { gte: startOfMonth },
        },
      },
      select: {
        quantity: true,
        product: {
          select: {
            category: {
              select: { name: true },
            },
          },
        },
      },
    })

    const categorySalesData = this.calculateCategorySales(categorySales)

    return {
      todaySales,
      todayRevenue,
      monthRevenue,
      lowStockProducts,
      recentSales: mappedRecentSales,
      weeklySalesData,
      categorySalesData,
    }
  }

  private calculateWeeklySales(sales: { saleDate: Date; total: number }[]) {
    const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
    const today = new Date()
    const weekData: { [key: number]: number } = {}

    for (let i = 0; i < 7; i++) {
      weekData[i] = 0
    }

    sales.forEach((sale) => {
      const saleDate = new Date(sale.saleDate)
      const dayOfWeek = saleDate.getDay() === 0 ? 6 : saleDate.getDay() - 1
      const diff = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diff < 7) {
        weekData[dayOfWeek] = (weekData[dayOfWeek] || 0) + (sale.total || 0)
      }
    })

    return days.map((day, index) => ({
      day,
      ventas: weekData[index] || 0,
    }))
  }

  private calculateCategorySales(
    items: { quantity: number; product: { category: { name: string } | null } | null }[]
  ) {
    const categoryMap: { [key: string]: number } = {}

    items.forEach((item) => {
      const categoryName = item.product?.category?.name || 'Sin categoría'
      categoryMap[categoryName] = (categoryMap[categoryName] || 0) + item.quantity
    })

    return Object.entries(categoryMap)
      .map(([name, ventas]) => ({
        name,
        ventas,
      }))
      .sort((a, b) => b.ventas - a.ventas)
      .slice(0, 5)
  }
}
