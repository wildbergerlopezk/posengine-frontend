"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Header } from "@/src/shared/components/Header"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
import { AlertCircle, ArrowDown, ArrowUp, Boxes, Loader2, Search, X, ChevronLeft, ChevronRight } from "lucide-react"
import styles from "./StockHistoryPage.module.css"

const API_BASE = API_BASE_URL
const LIMIT = 10

type MovementType = "INITIAL" | "PURCHASE" | "SALE" | "MANUAL"
type SourceType = "PURCHASE" | "SALE" | "MANUAL" | "RETURN"

interface Movement {
  id: string
  productId: string
  type: MovementType
  sourceType: SourceType
  quantity: number
  before: number
  after: number
  notes?: string | null
  referenceId?: string | null
  createdAt: string
  product?: {
    id: string
    name: string
    sku?: string | null
  }
}

interface PaginatedResponse {
  items: Movement[]
  total: number
  page: number
  limit: number
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatQty(value: number) {
  return Number(value).toLocaleString("es-PY", { maximumFractionDigits: 2 })
}

function getTypeLabel(type: MovementType) {
  const map: Record<MovementType, string> = {
    INITIAL: "Inicial",
    PURCHASE: "Compra",
    SALE: "Venta",
    MANUAL: "Manual",
  }
  return map[type]
}

export function StockHistoryPage() {
  const { accessToken } = useAuthStore()

  const [items, setItems] = useState<Movement[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<MovementType | "ALL">("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const fetchMovements = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      })
      if (search.trim()) params.set("search", search.trim())
      if (typeFilter !== "ALL") params.set("type", typeFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const res = await fetch(`${API_BASE}/stock-movements?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!res.ok) throw new Error("No se pudo cargar el historial de stock")

      const data: PaginatedResponse = await res.json()
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [accessToken, page, search, typeFilter, dateFrom, dateTo])

  useEffect(() => {
    void fetchMovements()
  }, [fetchMovements])

  // Reset page when filter changes
  useEffect(() => { setPage(1) }, [search, typeFilter, dateFrom, dateTo])

  const hasActiveFilters = search.trim() !== "" || typeFilter !== "ALL" || dateFrom !== "" || dateTo !== ""

  const clearFilters = () => {
    setSearch("")
    setTypeFilter("ALL")
    setDateFrom("")
    setDateTo("")
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className={styles.page}>
      <Header title="Historial de stock" />

      <div className={styles.container}>
        {/* ── Error banner ── */}
        {error && (
          <div className={tableStyles.errorBanner}>
            <AlertCircle size={16} />
            {error}
            <button type="button" className={styles.bannerClose} onClick={() => setError(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Filters ── */}
        <div className={styles.filtersBar}>
          <div className={styles.filtersRow}>
            <div className={styles.searchWrapper}>
              <Search size={15} className={styles.searchIcon} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
                placeholder="Buscar por producto, SKU o nota..."
              />
              {search && (
                <button type="button" className={styles.searchClear} onClick={() => setSearch("")}>
                  <X size={13} />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
                <X size={13} /> Limpiar filtros
              </button>
            )}
          </div>

          <div className={styles.filtersRow}>
            <div className={styles.statusTabs}>
              {(["ALL", "INITIAL", "PURCHASE", "SALE", "MANUAL"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`${styles.statusTab} ${typeFilter === tab ? styles.statusTabActive : ""}`}
                  onClick={() => setTypeFilter(tab)}
                >
                  {tab === "ALL" ? "Todos" : getTypeLabel(tab)}
                </button>
              ))}
            </div>

            <div className={styles.dateRange}>
              <input
                type="date"
                className={styles.dateInput}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Desde"
              />
              <span className={styles.dateSeparator}>→</span>
              <input
                type="date"
                className={styles.dateInput}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="Hasta"
              />
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className={tableStyles.tableCard}>
          <div className={styles.tableToolbar}>
            <span className={styles.tableTitle}>
              Movimientos <span className={styles.tableCount}>{total}</span>
            </span>
          </div>

          <table className={`${tableStyles.table} ${styles.historyTable}`}>
            <thead className={tableStyles.tableHeader}>
              <tr>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 140 }}>Fecha</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`}>Producto</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 100 }}>Tipo</th>
                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight} ${styles.headerCellOverride}`} style={{ width: 100 }}>Cantidad</th>
                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight} ${styles.headerCellOverride}`} style={{ width: 80 }}>Antes</th>
                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight} ${styles.headerCellOverride}`} style={{ width: 80 }}>Después</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`}>Detalle</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className={tableStyles.emptyState}>
                      <Loader2 size={26} className={tableStyles.spinner} />
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={tableStyles.emptyState}>
                      <Boxes size={32} className={tableStyles.emptyStateIcon} />
                      <p className={tableStyles.emptyStateTitle}>Sin movimientos de stock</p>
                      <p>No hay resultados con los filtros aplicados</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isPositive = item.quantity >= 0
                  return (
                    <tr key={item.id} className={tableStyles.tableRow}>
                      <td className={tableStyles.tableCell}>
                        <span className={styles.dateText}>{formatDateTime(item.createdAt)}</span>
                      </td>
                      <td className={tableStyles.tableCell}>
                        <div className={styles.productCell}>
                          <span className={styles.productName}>{item.product?.name ?? "Producto eliminado"}</span>
                          <span className={styles.productSku}>{item.product?.sku ?? "Sin SKU"}</span>
                        </div>
                      </td>
                      <td className={tableStyles.tableCell}>
                        <span className={styles.typeBadge}>{getTypeLabel(item.type)}</span>
                      </td>
                      <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                        <span className={`${styles.qty} ${isPositive ? styles.qtyIn : styles.qtyOut}`}>
                          {isPositive ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                          {formatQty(Math.abs(item.quantity))}
                        </span>
                      </td>
                      <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                        <span className={styles.stockValue}>{formatQty(item.before)}</span>
                      </td>
                      <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                        <span className={styles.stockValue}>{formatQty(item.after)}</span>
                      </td>
                      <td className={tableStyles.tableCell}>
                        <span className={styles.noteText}>{item.notes || "—"}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                Mostrando {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} de {total}
              </span>
              <div className={styles.paginationControls}>
                <button
                  type="button"
                  className={styles.pageBtn}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "...")[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...")
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === "..." ? (
                      <span key={`dots-${i}`} className={styles.pageDots}>…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ""}`}
                        onClick={() => setPage(p as number)}
                      >
                        {p}
                      </button>
                    )
                  )
                }
                <button
                  type="button"
                  className={styles.pageBtn}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}