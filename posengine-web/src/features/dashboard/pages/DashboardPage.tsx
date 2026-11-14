"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Package,
  ShoppingBag,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react"
import { Header } from "@/src/shared/components/Header"
import { ApiError } from "@/src/shared/api/apiClient"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { getDashboardData, type DashboardDataResponse } from "../api/dashboard.api"
import styles from "./DashboardPage.module.css"

const money = new Intl.NumberFormat("es-PY", {
  style: "currency",
  currency: "PYG",
  maximumFractionDigits: 0,
})

const units: Record<DashboardDataResponse["stock"]["items"][number]["unitType"], string> = {
  UNIT: "unid.",
  KG: "kg",
  G: "g",
  L: "L",
  ML: "ml",
  MG: "mg",
}

function formatMoney(value: number) {
  return money.format(value)
}

function formatBusinessDateTime(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-PY", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function DashboardPage() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const [dashboardData, setDashboardData] = useState<DashboardDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!accessToken) return
    let current = true
    setLoading(true)
    setError(null)

    void getDashboardData(accessToken)
      .then((data) => {
        if (current) setDashboardData(data)
      })
      .catch((requestError) => {
        const diagnostic = requestError instanceof ApiError
          ? { status: requestError.status, code: requestError.code, requestId: requestError.requestId }
          : { error: requestError instanceof Error ? requestError.message : "Unknown dashboard error" }
        console.warn("No se pudieron cargar las estadísticas del Dashboard.", diagnostic)
        if (current) {
          const reference = requestError instanceof ApiError && requestError.requestId
            ? ` Referencia: ${requestError.requestId}.`
            : ""
          setError(`No se pudieron cargar los datos del Dashboard.${reference}`)
        }
      })
      .finally(() => {
        if (current) setLoading(false)
      })

    return () => {
      current = false
    }
  }, [accessToken, reloadKey])

  const retry = useCallback(() => setReloadKey((key) => key + 1), [])

  if (loading && !dashboardData) {
    return (
      <div className={styles.page}>
        <Header title="Dashboard" />
        <main className={styles.container} aria-label="Cargando Dashboard">
          <div className={styles.loadingGrid}>
            {[1, 2, 3, 4].map((item) => <div className={styles.loadingCard} key={item} />)}
          </div>
          <div className={styles.loadingContent} />
        </main>
      </div>
    )
  }

  if (error && !dashboardData) {
    return (
      <div className={styles.page}>
        <Header title="Dashboard" />
        <main className={styles.errorState}>
          <AlertTriangle size={32} aria-hidden="true" />
          <p>{error}</p>
          <button type="button" onClick={retry} className={styles.retryButton}>Reintentar</button>
        </main>
      </div>
    )
  }

  if (!dashboardData) return null

  const { billing, collections, cash, receivables, stock, recentSales } = dashboardData

  return (
    <div className={styles.page}>
      <Header title="Dashboard" />

      <main className={styles.container}>
        {!dashboardData.returnTrackingAvailable && (
          <p className={styles.schemaWarning} role="status">
            Falta aplicar en esta base la migración de devoluciones de ventas. El Dashboard muestra la facturación sin descontar devoluciones; aplicá las migraciones pendientes antes de habilitar esa operación.
          </p>
        )}
        <nav className={styles.quickActions} aria-label="Acciones rápidas">
          <Link href="/dashboard/sales/pos" className={styles.actionLink}>
            <ShoppingCart size={16} aria-hidden="true" /> Nueva venta
          </Link>
          <Link href="/dashboard/purchases/new" className={styles.actionLink}>
            <ShoppingBag size={16} aria-hidden="true" /> Nueva compra
          </Link>
          <Link href="/dashboard/clients/payments" className={styles.actionLink}>
            <CircleDollarSign size={16} aria-hidden="true" /> Cobrar deuda
          </Link>
          <Link href="/dashboard/cash" className={styles.actionLinkSecondary}>
            <Wallet size={16} aria-hidden="true" /> Control de caja
          </Link>
        </nav>

        <section className={styles.statsGrid} aria-label="Indicadores del comercio">
          <article className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>Facturación bruta de hoy</span>
              <span className={`${styles.statIcon} ${styles.iconBlue}`}><ShoppingCart size={17} /></span>
            </div>
            <strong className={styles.statValue}>{formatMoney(billing.today)}</strong>
            <span className={styles.statMeta}>{billing.todaySalesCount} ventas completadas</span>
            {billing.todayReturns > 0 && <span className={styles.statMeta}>Devoluciones {formatMoney(billing.todayReturns)} · neta {formatMoney(billing.netToday)}</span>}
            {billing.creditBalanceToday > 0 && (
              <span className={styles.statMeta}>Saldo crédito de hoy: {formatMoney(billing.creditBalanceToday)}</span>
            )}
          </article>

          <article className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>Cobros de hoy</span>
              <span className={`${styles.statIcon} ${styles.iconGreen}`}><Banknote size={17} /></span>
            </div>
            <strong className={styles.statValue}>{formatMoney(collections.today)}</strong>
            <span className={styles.statMeta}>
              Efectivo {formatMoney(collections.cash)} · Electrónico {formatMoney(collections.electronic)}
              {collections.unclassified > 0 ? ` · Pendiente ${formatMoney(collections.unclassified)}` : ""}
            </span>
          </article>

          <article className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>Efectivo esperado</span>
              <span className={`${styles.statIcon} ${cash.reconciliationPending ? styles.iconYellow : styles.iconBlue}`}>
                <Wallet size={17} />
              </span>
            </div>
            <strong className={`${styles.statValue} ${cash.reconciliationPending ? styles.pendingValue : ""}`}>
              {cash.status === "CLOSED"
                ? "Caja cerrada"
                : cash.expectedAmount === null
                  ? "Pendiente de conciliación"
                  : formatMoney(cash.expectedAmount)}
            </strong>
            <span className={styles.statMeta}>
              {cash.status === "CLOSED" ? "Sin sesión abierta" : cash.reconciliationPending ? "Revisá los medios de pago" : "Sesión actual · conciliada"}
            </span>
          </article>

          <article className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>Cuentas por cobrar</span>
              <span className={`${styles.statIcon} ${styles.iconViolet}`}><Users size={17} /></span>
            </div>
            <strong className={styles.statValue}>{formatMoney(receivables.balance)}</strong>
            <span className={styles.statMeta}>{receivables.customersCount} clientes con saldo pendiente</span>
          </article>
        </section>

        <div className={styles.monthSummary}>
          <TrendingUpIcon />
          <span>{dashboardData.returnTrackingAvailable ? "Facturación neta del mes" : "Facturación del mes"}</span>
          <strong>{formatMoney(billing.netMonth)}</strong>
          {billing.monthReturns > 0 && <small>Bruta {formatMoney(billing.month)} · devoluciones {formatMoney(billing.monthReturns)}</small>}
        </div>

        <section className={styles.contentGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2><AlertTriangle size={17} aria-hidden="true" /> Requieren atención</h2>
            </div>
            <div className={styles.panelBody}>
              {stock.lowStockCount === 0 && stock.outOfStockCount === 0 && !cash.reconciliationPending && cash.status === "OPEN" ? (
                <div className={styles.allClear}><CheckCircle2 size={17} /> Sin alertas operativas.</div>
              ) : (
                <div className={styles.alertSummary}>
                  {stock.lowStockCount > 0 && (
                    <Link href="/dashboard/stock?stockStatus=LOW&isActive=true" className={styles.alertLink}>
                      <span><Package size={16} /> Productos con stock bajo</span>
                      <strong>{stock.lowStockCount}</strong>
                    </Link>
                  )}
                  {stock.outOfStockCount > 0 && (
                    <Link href="/dashboard/stock?stockStatus=LOW&isActive=true" className={`${styles.alertLink} ${styles.alertLinkDanger}`}>
                      <span><AlertTriangle size={16} /> Sin existencias</span>
                      <strong>{stock.outOfStockCount}</strong>
                    </Link>
                  )}
                  {cash.status === "CLOSED" && (
                    <Link href="/dashboard/cash" className={styles.alertLink}>
                      <span><Wallet size={16} /> Caja cerrada</span><ArrowRight size={15} />
                    </Link>
                  )}
                  {cash.reconciliationPending && (
                    <Link href="/dashboard/cash" className={`${styles.alertLink} ${styles.alertLinkDanger}`}>
                      <span><CreditCard size={16} /> Conciliación de caja pendiente</span><ArrowRight size={15} />
                    </Link>
                  )}
                  {stock.items.length > 0 && (
                    <ul className={styles.stockPreview}>
                      {stock.items.slice(0, 4).map((product) => (
                        <li key={product.id}>
                          <span className={styles.stockName} title={product.name}>{product.name}</span>
                          <span>{product.stock} {units[product.unitType] ?? product.unitType}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2><Clock3 size={17} aria-hidden="true" /> Últimas ventas</h2>
              <Link className={styles.panelLink} href="/dashboard/sales/history">Ver historial <ArrowRight size={14} /></Link>
            </div>
            <div className={styles.panelBody}>
              {recentSales.length > 0 ? (
                <ul className={styles.salesList}>
                  {recentSales.map((sale) => (
                    <li className={styles.saleRow} key={sale.id}>
                      <div className={styles.saleDetails}>
                        <strong title={sale.customerName}>{sale.customerName}</strong>
                        <span>
                          {formatBusinessDateTime(sale.saleDate, dashboardData.timezone)} · {sale.paymentType === "CREDIT" ? "Crédito" : "Contado"}
                          {sale.itemCount > 0 ? ` · ${sale.itemCount} ítem${sale.itemCount === 1 ? "" : "s"}` : ""}
                        </span>
                      </div>
                      <strong className={styles.saleTotal}>{formatMoney(sale.total)}</strong>
                    </li>
                  ))}
                </ul>
              ) : <p className={styles.emptyState}>Todavía no hay ventas completadas.</p>}
            </div>
          </article>

        </section>
      </main>
    </div>
  )
}

function TrendingUpIcon() {
  return <Banknote size={15} aria-hidden="true" />
}
