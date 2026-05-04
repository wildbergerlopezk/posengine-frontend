"use client"

import { Header } from "@/src/shared/components/Header"
import { DollarSign, ShoppingCart, AlertTriangle, TrendingUp, ArrowUpRight, Loader2 } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import styles from "./DashboardPage.module.css"
import { useEffect, useState } from "react"
import { getDashboardData } from "../api/dashboard.api"
import type { DashboardDataResponse, WeeklySalesData, CategorySalesData } from "../api/dashboard.api"

export function DashboardPage() {
  const { user, accessToken } = useAuthStore()
  const [dashboardData, setDashboardData] = useState<DashboardDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getDashboardData(accessToken)
        setDashboardData(data)
      } catch (err) {
        console.error("Error loading dashboard data:", err)
        setError("No se pudieron cargar los datos del dashboard")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [accessToken])

  if (loading) {
    return (
      <div className={styles.page}>
        <Header title="Dashboard" />
        <div className={styles.loadingContainer}>
          <Loader2 size={40} className={styles.spinner} />
          <p>Cargando datos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <Header title="Dashboard" />
        <div className={styles.errorContainer}>
          <AlertTriangle size={40} />
          <p>{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              setError(null)
              const fetchData = async () => {
                try {
                  const data = await getDashboardData(accessToken!)
                  setDashboardData(data)
                } catch (err) {
                  console.error("Error loading dashboard data:", err)
                  setError("No se pudieron cargar los datos del dashboard. Verifica que el servidor esté en línea.")
                } finally {
                  setLoading(false)
                }
              }
              fetchData()
            }}
            className={styles.retryButton}
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className={styles.page}>
        <Header title="Dashboard" />
        <div className={styles.errorContainer}>
          <AlertTriangle size={40} />
          <p>No se pudieron cargar los datos</p>
        </div>
      </div>
    )
  }

  const stats = {
    todaySales: dashboardData.todaySales,
    todayRevenue: dashboardData.todayRevenue,
    monthRevenue: dashboardData.monthRevenue,
    lowStockProducts: dashboardData.lowStockProducts.length,
  }
  const lowStockProducts = dashboardData.lowStockProducts
  const recentSales = dashboardData.recentSales
  const salesData = dashboardData.weeklySalesData
  const categoryData = dashboardData.categorySalesData

  return (
    <div className={styles.page}>
      <Header title="Dashboard" />

      <div className={styles.container}>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>Ventas hoy</span>
              <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
                <ShoppingCart size={16} />
              </div>
            </div>
            <div className={styles.statValue}>{stats.todaySales}</div>
            <div className={styles.statChange}>
              <TrendingUp size={12} />
              <span>Ventas registradas</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>Ingresos hoy</span>
              <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
                <DollarSign size={16} />
              </div>
            </div>
            <div className={styles.statValue}>{formatCurrency(stats.todayRevenue)}</div>
            <div className={styles.statChange}>
              <ArrowUpRight size={12} />
              <span>Total recaudado</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>Ingresos del mes</span>
              <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
                <TrendingUp size={16} />
              </div>
            </div>
            <div className={styles.statValue}>{formatCurrency(stats.monthRevenue)}</div>
            <div className={styles.statChange}>
              <ArrowUpRight size={12} />
              <span>Período actual</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>Stock bajo</span>
              <div className={`${styles.statIcon} ${styles.statIconYellow}`}>
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className={styles.statValueWarning}>{stats.lowStockProducts}</div>
            <div className={styles.statSubtext}>productos requieren atención</div>
          </div>
        </div>

        <div className={styles.chartsGrid}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Ventas de la semana</h3>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData}>
                    <defs>
                      <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Ventas"]}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ventas"
                      stroke="#2563eb"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorVentas)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Ventas por categoría</h3>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip
                      formatter={(value: number) => [`${value} ventas`, "Cantidad"]}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="ventas" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.bottomGrid}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitleWithIcon}>
                <AlertTriangle size={20} color="#f59e0b" />
                Alertas de stock bajo
              </h3>
            </div>
            <div className={styles.cardContent}>
              {lowStockProducts.length > 0 ? (
                <div className={styles.alertList}>
                  {lowStockProducts.map((product) => (
                    <div key={product.id} className={styles.alertItem}>
                      <div className={styles.alertInfo}>
                        <span className={styles.alertTitle}>{product.name}</span>
                        <span className={styles.alertSubtitle}>Stock mínimo: {product.stockMinimum}</span>
                      </div>
                      <div className={styles.alertValue}>
                        <span className={styles.alertNumber}>{product.stock}</span>
                        <span className={styles.alertUnit}>unidades</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyState}>No hay productos con stock bajo</p>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Últimas ventas</h3>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.salesList}>
                {recentSales && recentSales.length > 0 ? (
                  recentSales.map((sale) => (
                    <div key={sale.id} className={styles.saleItem}>
                      <div className={styles.saleInfo}>
                        <span className={styles.saleTitle}>
                          {sale.items?.length || 0} producto{(sale.items?.length || 0) > 1 ? "s" : ""}
                        </span>
                        <span className={styles.saleTime}>
                          {new Date(sale.createdAt).toLocaleString("es-AR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className={styles.saleAmount}>
                        <span className={styles.saleMethod}>
                          {sale.paymentMethod === "CASH"
                            ? "Efectivo"
                            : sale.paymentMethod === "CARD"
                              ? "Tarjeta"
                              : sale.paymentMethod === "TRANSFER"
                                ? "Transferencia"
                                : sale.paymentMethod}
                        </span>
                        <span className={styles.saleTotal}>{formatCurrency(sale.total)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyState}>No hay ventas registradas</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
