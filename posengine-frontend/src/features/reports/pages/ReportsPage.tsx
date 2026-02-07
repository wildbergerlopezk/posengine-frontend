"use client"

import { useState } from "react"
import { Header } from "@/src/shared/components/Header"
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart, Package, Calendar } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
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

const dailyData = [
  { hour: "08:00", ventas: 2500, ganancias: 800 },
  { hour: "10:00", ventas: 4200, ganancias: 1400 },
  { hour: "12:00", ventas: 8600, ganancias: 2900 },
  { hour: "14:00", ventas: 6800, ganancias: 2200 },
  { hour: "16:00", ventas: 9200, ganancias: 3100 },
  { hour: "18:00", ventas: 12400, ganancias: 4200 },
  { hour: "20:00", ventas: 7800, ganancias: 2600 },
]

const weeklyData = [
  { day: "Lun", ventas: 45200, ganancias: 15200 },
  { day: "Mar", ventas: 52800, ganancias: 17800 },
  { day: "Mié", ventas: 48600, ganancias: 16400 },
  { day: "Jue", ventas: 61400, ganancias: 20800 },
  { day: "Vie", ventas: 78600, ganancias: 26500 },
  { day: "Sáb", ventas: 95200, ganancias: 32100 },
  { day: "Dom", ventas: 62800, ganancias: 21200 },
]

const monthlyData = [
  { week: "Sem 1", ventas: 285400, ganancias: 96200 },
  { week: "Sem 2", ventas: 312600, ganancias: 105400 },
  { week: "Sem 3", ventas: 298200, ganancias: 100500 },
  { week: "Sem 4", ventas: 354200, ganancias: 119400 },
]

const yearlyData = [
  { month: "Ene", ventas: 1250000, ganancias: 421000 },
  { month: "Feb", ventas: 1180000, ganancias: 397000 },
  { month: "Mar", ventas: 1320000, ganancias: 445000 },
  { month: "Abr", ventas: 1150000, ganancias: 387000 },
  { month: "May", ventas: 1280000, ganancias: 431000 },
  { month: "Jun", ventas: 1420000, ganancias: 478000 },
  { month: "Jul", ventas: 1380000, ganancias: 465000 },
  { month: "Ago", ventas: 1450000, ganancias: 489000 },
  { month: "Sep", ventas: 1350000, ganancias: 455000 },
  { month: "Oct", ventas: 1480000, ganancias: 499000 },
  { month: "Nov", ventas: 1520000, ganancias: 512000 },
  { month: "Dic", ventas: 1680000, ganancias: 566000 },
]

const categoryPieData = [
  { name: "Bebidas", value: 35, color: "#2563eb" },
  { name: "Snacks", value: 25, color: "#0ea5e9" },
  { name: "Lácteos", value: 20, color: "#22c55e" },
  { name: "Panadería", value: 12, color: "#f59e0b" },
  { name: "Otros", value: 8, color: "#ef4444" },
]

export function ReportsPage() {
  const { tenant } = useAuthStore()
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("week")

  const getData = () => {
    switch (period) {
      case "day":
        return dailyData
      case "week":
        return weeklyData
      case "month":
        return monthlyData
      case "year":
        return yearlyData
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
    const totalVentas = data.reduce((sum, d) => sum + d.ventas, 0)
    const totalGanancias = data.reduce((sum, d) => sum + d.ganancias, 0)
    const totalPerdidas = totalVentas - totalGanancias
    return { totalVentas, totalGanancias, totalPerdidas }
  }

  const { totalVentas, totalGanancias, totalPerdidas } = getTotals()

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
            <Calendar size={14} />
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
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryLabel}>Ganancias</span>
              <TrendingUp size={16} color="#22c55e" />
            </div>
            <div className={`${styles.summaryValue} ${styles.summaryValueSuccess}`}>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryLabel}>Costos</span>
              <TrendingDown size={16} color="#ef4444" />
            </div>
            <div className={`${styles.summaryValue} ${styles.summaryValueDestructive}`}>
            </div>
          </div>
        </div>

        {/* Charts */}
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

          {/* Pie Chart */}
          <div className={styles.card}>
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
                      data={categoryPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {categoryPieData.map((entry, index) => (
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
      </div>
    </div>
  )
}
