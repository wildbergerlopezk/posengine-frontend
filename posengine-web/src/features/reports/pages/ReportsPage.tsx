"use client"

import { useState, useMemo } from "react"
import { Header } from "@/src/shared/components/Header"
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart, Package, Calendar, Loader2 } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { useReportsData } from "../hooks/useReportsData"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import styles from "./ReportsPage.module.css"

// Fallback data para cuando no hay datos reales
const fallbackCategoryData = [
  { name: "Bebidas", value: 35, color: "#2563eb" },
  { name: "Snacks", value: 25, color: "#0ea5e9" },
  { name: "Lácteos", value: 20, color: "#22c55e" },
  { name: "Panadería", value: 12, color: "#f59e0b" },
  { name: "Otros", value: 8, color: "#ef4444" },
]

export function ReportsPage() {
  const { user } = useAuthStore()
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("week")
  const { daily, weekly, monthly, yearly, loading, error } = useReportsData()

  const getData = () => {
    switch (period) {
      case "day":
        return daily
      case "week":
        return weekly
      case "month":
        return monthly
      case "year":
        return yearly
    }
  }

  const getXKey = () => {
    switch (period) {
      case "day":
        return "hour"
      case "week":
        return "day"
      case "month":
        return "week"
      case "year":
        return "month"
    }
  }

  const getTotals = () => {
    const data = getData()
    const totalVentas = data.reduce((sum, d) => sum + (Number(d.ventas) || 0), 0)
    const totalGanancias = data.reduce((sum, d) => sum + (Number(d.ganancias) || 0), 0)
    const totalPerdidas = totalVentas - totalGanancias
    return { totalVentas, totalGanancias, totalPerdidas }
  }

  const { totalVentas, totalGanancias, totalPerdidas } = getTotals()
  const hasData = getData().length > 0

  return (
    <div className={styles.page}>
      <Header title="Reportes" />

      <div className={styles.container}>
        {/* Period Selector */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tabButton} ${period === "day" ? styles.tabButtonActive : ""}`}
            onClick={() => setPeriod("day")}
          >
            <Calendar size={12} />
            Día
          </button>
          <button
            className={`${styles.tabButton} ${period === "week" ? styles.tabButtonActive : ""}`}
            onClick={() => setPeriod("week")}
          >
            Semana
          </button>
          <button
            className={`${styles.tabButton} ${period === "month" ? styles.tabButtonActive : ""}`}
            onClick={() => setPeriod("month")}
          >
            Mes
          </button>
          <button
            className={`${styles.tabButton} ${period === "year" ? styles.tabButtonActive : ""}`}
            onClick={() => setPeriod("year")}
          >
            Año
          </button>
        </div>

        {/* Summary Cards */}
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryLabel}>Total Vendido</span>
              <DollarSign size={16} color="#64748b" />
            </div>
            <div className={styles.summaryValue}>
              {loading ? "..." : formatCurrency(totalVentas)}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryLabel}>Ganancias</span>
              <TrendingUp size={16} color="#22c55e" />
            </div>
            <div className={`${styles.summaryValue} ${styles.summaryValueSuccess}`}>
              {loading ? "..." : formatCurrency(totalGanancias)}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryLabel}>Costos</span>
              <TrendingDown size={16} color="#ef4444" />
            </div>
            <div className={`${styles.summaryValue} ${styles.summaryValueDestructive}`}>
              {loading ? "..." : formatCurrency(totalPerdidas)}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "200px",
            gap: "0.5rem",
          }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "0.875rem" }}>Cargando reportes...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: "0.5rem",
            color: "#991b1b",
            fontSize: "0.875rem",
          }}>
            Error al cargar reportes: {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !hasData && (
          <div style={{
            padding: "2rem 1rem",
            textAlign: "center",
            color: "var(--color-muted-foreground)",
          }}>
            <Package size={24} style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
            <p style={{ fontSize: "0.875rem", margin: "0 0 0.25rem" }}>No hay datos disponibles para este período</p>
            <p style={{ fontSize: "0.75rem", margin: 0 }}>
              Los datos aparecerán aquí cuando se registren ventas
            </p>
          </div>
        )}

        {/* Charts */}
        {!loading && hasData && (
          <div className={styles.chartsGrid}>
            {/* Sales Chart */}
            <div className={`${styles.card} ${styles.cardWide}`}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <ShoppingCart size={20} />
                  Ventas y Ganancias
                </h3>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={getData()}>
                      <defs>
                        <linearGradient id="colorVentas2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorGanancias2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey={getXKey()} tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => (period === "year" ? `$${v / 1000000}M` : `$${v / 1000}k`)}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          formatCurrency(value),
                          name === "ventas" ? "Ventas" : "Ganancias",
                        ]}
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
                        fill="url(#colorVentas2)"
                      />
                      <Area
                        type="monotone"
                        dataKey="ganancias"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorGanancias2)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Bar Chart */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Comparativa por período</h3>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.chartContainerSmall}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey={getXKey()} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="ventas" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="ganancias" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Pie Chart — ocupa todo el ancho */}
            <div className={`${styles.card} ${styles.cardWide}`}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <Package size={20} />
                  Ventas por Categoría
                </h3>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.chartContainerSmall}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fallbackCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {fallbackCategoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, "Participación"]}
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
