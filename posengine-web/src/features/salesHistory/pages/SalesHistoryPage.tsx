"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/src/shared/components/Header"
import {
  Search, Eye, Package, AlertCircle, Loader2,
  X, ChevronLeft, ChevronRight, CheckCircle2,
  XCircle, Calendar, Receipt, Hash, Ban,
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { API_BASE_URL } from "@/src/shared/config/api"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
import styles from "./SalesHistoryPage.module.css"

const API_BASE = API_BASE_URL

// ─── Types ────────────────────────────────────────────────────────────────────

type SaleStatus = "COMPLETED" | "CANCELLED"

interface Product {
  id: string
  name: string
  barcode?: string
  sku?: string
  unitType: string
}

interface SaleItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  total: number
  product: Product
}

interface Sale {
  id: string
  saleDate: string
  total: number
  status: SaleStatus
  notes?: string
  createdAt: string
  cashSession?: { id: string; openedAt: string; status: string }
  items?: SaleItem[]
}

interface PaginatedResponse {
  items: Sale[]
  total: number
  page: number
  limit: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SaleStatus, { label: string; icon: React.ReactNode; className: string }> = {
  COMPLETED: {
    label: "Completada",
    icon: <CheckCircle2 size={12} />,
    className: styles.statusCompleted,
  },
  CANCELLED: {
    label: "Anulada",
    icon: <XCircle size={12} />,
    className: styles.statusCancelled,
  },
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PY", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  })
}

function formatQuantity(qty: number, unitType: string) {
  return unitType === "UNIT" ? String(qty) : qty % 1 === 0 ? String(qty) : qty.toFixed(3)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesHistoryPage() {
  const { accessToken } = useAuthStore()
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  // ── List state ─────────────────────────────────────────────────────────────
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<SaleStatus | "ALL">("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const LIMIT = 10

  // ── Detail modal state ─────────────────────────────────────────────────────
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // ── Fetch list ─────────────────────────────────────────────────────────────
  const fetchSales = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (statusFilter !== "ALL") params.set("status", statusFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo)   params.set("dateTo", dateTo)

      const res = await fetch(`${API_BASE}/sales?${params}`, { headers: authHeaders })
      if (!res.ok) throw new Error("Error al cargar ventas")
      const data: PaginatedResponse = await res.json()
      setSales(data.items ?? [])
      setTotalItems(data.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, dateFrom, dateTo, accessToken])

  useEffect(() => { void fetchSales() }, [fetchSales])
  useEffect(() => { setPage(1) }, [statusFilter, dateFrom, dateTo, search])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const hasActiveFilters = statusFilter !== "ALL" || dateFrom || dateTo || search

  const clearFilters = () => {
    setSearch("")
    setStatusFilter("ALL")
    setDateFrom("")
    setDateTo("")
  }

  // ── Open detail modal ──────────────────────────────────────────────────────
  const openDetail = async (sale: Sale) => {
    setSelectedSale({ ...sale, items: undefined })
    setLoadingDetail(true)
    setDetailError(null)
    setCancelError(null)
    try {
      const res = await fetch(`${API_BASE}/sales/${sale.id}`, { headers: authHeaders })
      if (!res.ok) throw new Error("Error al cargar el detalle")
      const data: Sale = await res.json()
      setSelectedSale(data)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Error al cargar detalle")
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeDetail = () => {
    setSelectedSale(null)
    setDetailError(null)
    setCancelError(null)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeDetail() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // ── Cancel sale ────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!selectedSale) return
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await fetch(`${API_BASE}/sales/${selectedSale.id}/cancel`, {
        method: "PATCH",
        headers: authHeaders,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Error al anular la venta")
      }
      await fetchSales()
      closeDetail()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setCancelling(false)
    }
  }

  // ── Filtered sales (client-side search by ID) ──────────────────────────────
  const filteredSales = search.trim()
    ? sales.filter(s => s.id.toLowerCase().includes(search.toLowerCase()))
    : sales

  const totalPages = Math.ceil(totalItems / LIMIT)

  return (
    <div className={styles.page}>
      <Header title="Historial de ventas" />

      <div className={styles.container}>

        {error && (
          <div className={tableStyles.errorBanner}>
            <AlertCircle size={16} />
            {error}
            <button type="button" className={styles.bannerClose} onClick={() => setError(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Filtros ── */}
        <div className={styles.filtersBar}>
          <div className={styles.filtersRow}>
            <div className={styles.searchWrapper}>
              <Search size={15} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Buscar por ID de venta…"
                value={search}
                onChange={e => setSearch(e.target.value)}
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
              {(["ALL", "COMPLETED", "CANCELLED"] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  className={`${styles.statusTab} ${statusFilter === s ? styles.statusTabActive : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "ALL" ? "Todos" : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>

            <div className={styles.dateRange}>
              <input type="date" className={styles.dateInput} value={dateFrom}
                onChange={e => setDateFrom(e.target.value)} title="Desde" />
              <span className={styles.dateSeparator}>→</span>
              <input type="date" className={styles.dateInput} value={dateTo}
                onChange={e => setDateTo(e.target.value)} title="Hasta" />
            </div>
          </div>
        </div>

        {/* ── Tabla ── */}
        <div className={tableStyles.tableCard}>
          <div className={styles.tableToolbar}>
            <span className={styles.tableTitle}>
              Ventas <span className={styles.tableCount}>{totalItems}</span>
            </span>
          </div>

          <table className={`${tableStyles.table} ${styles.historyTable}`}>
            <thead className={tableStyles.tableHeader}>
              <tr>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 210 }}>ID Venta</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 170 }}>Fecha</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 80 }}>Items</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 120 }}>Estado</th>
                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight} ${styles.headerCellOverride}`} style={{ width: 150 }}>Total</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}>
                  <div className={tableStyles.emptyState}>
                    <Loader2 size={28} className={tableStyles.spinner} />
                  </div>
                </td></tr>
              ) : filteredSales.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className={tableStyles.emptyState}>
                    <Package size={36} className={tableStyles.emptyStateIcon} />
                    <p className={tableStyles.emptyStateTitle}>Sin ventas registradas</p>
                    <p>No se encontraron ventas con los filtros seleccionados</p>
                  </div>
                </td></tr>
              ) : (
                filteredSales.map(sale => {
                  const sc = STATUS_CONFIG[sale.status] ?? STATUS_CONFIG.COMPLETED
                  return (
                    <tr key={sale.id} className={tableStyles.tableRow}>
                      <td className={tableStyles.tableCell}>
                        <span className={styles.saleIdChip}>#{sale.id.slice(0, 8)}</span>
                      </td>
                      <td className={tableStyles.tableCell}>
                        <span className={styles.dateText}>{formatDateTime(sale.saleDate)}</span>
                      </td>
                      <td className={tableStyles.tableCell}>
                        <span className={styles.itemsCount}>{sale.items?.length ?? "—"}</span>
                      </td>
                      <td className={tableStyles.tableCell}>
                        <span className={`${styles.statusBadge} ${sc.className}`}>
                          {sc.icon}{sc.label}
                        </span>
                      </td>
                      <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                        <strong className={styles.totalAmount}>{formatCurrency(sale.total)}</strong>
                      </td>
                      <td className={tableStyles.tableCell}>
                        <button
                          type="button"
                          className={styles.viewBtn}
                          onClick={() => openDetail(sale)}
                          title="Ver detalle"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                Mostrando {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, totalItems)} de {totalItems}
              </span>
              <div className={styles.paginationControls}>
                <button type="button" className={styles.pageBtn}
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
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
                      <button key={p} type="button"
                        className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ""}`}
                        onClick={() => setPage(p as number)}
                      >{p}</button>
                    )
                  )}
                <button type="button" className={styles.pageBtn}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail modal ── */}
      {selectedSale && (
        <div className={tableStyles.modalOverlay} onClick={closeDetail}>
          <div className={styles.detailModal} onClick={e => e.stopPropagation()}>

            <div className={styles.detailModalHeader}>
              <div className={styles.detailModalHeaderLeft}>
                <Receipt size={18} className={styles.detailModalIcon} />
                <div>
                  <h2 className={styles.detailModalTitle}>Detalle de venta</h2>
                  <p className={styles.detailModalSubtitle}>#{selectedSale.id.slice(0, 8)}</p>
                </div>
              </div>
              <button type="button" className={styles.modalCloseBtn} onClick={closeDetail}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.detailModalBody}>

              {/* Info header */}
              <div className={styles.receiptHeader}>
                <div className={styles.receiptHeaderGrid}>
                  <div className={styles.receiptInfoBlock}>
                    <div className={styles.receiptInfoRow}>
                      <Hash size={14} className={styles.receiptInfoIcon} />
                      <div>
                        <span className={styles.receiptInfoLabel}>ID de venta</span>
                        <span className={`${styles.receiptInfoValue} ${styles.receiptIdValue}`}>{selectedSale.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.receiptInfoBlock}>
                    <div className={styles.receiptInfoRow}>
                      <Calendar size={14} className={styles.receiptInfoIcon} />
                      <div>
                        <span className={styles.receiptInfoLabel}>Fecha</span>
                        <span className={styles.receiptInfoValue}>{formatDateTime(selectedSale.saleDate)}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.receiptInfoBlock}>
                    <div className={styles.receiptInfoRow}>
                      <CheckCircle2 size={14} className={styles.receiptInfoIcon} />
                      <div>
                        <span className={styles.receiptInfoLabel}>Estado</span>
                        <span className={`${styles.statusBadge} ${STATUS_CONFIG[selectedSale.status]?.className ?? styles.statusCompleted}`}>
                          {STATUS_CONFIG[selectedSale.status]?.icon}
                          {STATUS_CONFIG[selectedSale.status]?.label ?? selectedSale.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedSale.notes && (
                    <div className={`${styles.receiptInfoBlock} ${styles.receiptInfoBlockFull}`}>
                      <div className={styles.receiptInfoRow}>
                        <Receipt size={14} className={styles.receiptInfoIcon} />
                        <div>
                          <span className={styles.receiptInfoLabel}>Observaciones</span>
                          <span className={styles.receiptInfoValue}>{selectedSale.notes}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className={styles.receiptItemsSection}>
                <div className={styles.receiptItemsTitle}>
                  <Package size={14} />
                  Productos
                  {selectedSale.items && (
                    <span className={styles.receiptItemsCount}>{selectedSale.items.length}</span>
                  )}
                </div>

                {loadingDetail ? (
                  <div className={styles.detailLoading}>
                    <Loader2 size={22} className={tableStyles.spinner} />
                    <span>Cargando productos…</span>
                  </div>
                ) : detailError ? (
                  <div className={styles.detailError}>
                    <AlertCircle size={16} />{detailError}
                  </div>
                ) : (
                  <table className={styles.receiptTable}>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th style={{ width: 120 }}>Código</th>
                        <th>Descripción</th>
                        <th style={{ width: 90, textAlign: "right" }}>Cant.</th>
                        <th style={{ width: 130, textAlign: "right" }}>Precio unit.</th>
                        <th style={{ width: 130, textAlign: "right" }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedSale.items ?? []).map((item, idx) => (
                        <tr key={item.id}>
                          <td className={styles.receiptTableNum}>{idx + 1}</td>
                          <td>
                            <span className={styles.codeChip}>
                              {item.product.barcode || item.product.sku || "—"}
                            </span>
                          </td>
                          <td className={styles.receiptTableName}>{item.product.name}</td>
                          <td className={styles.receiptTableRight}>
                            {formatQuantity(item.quantity, item.product.unitType)}
                            {item.product.unitType !== "UNIT" && (
                              <span className={styles.unitLabel}> {item.product.unitType}</span>
                            )}
                          </td>
                          <td className={styles.receiptTableRight}>{formatCurrency(item.unitPrice)}</td>
                          <td className={`${styles.receiptTableRight} ${styles.receiptTableSubtotal}`}>
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {!loadingDetail && !detailError && (
                <>
                  <div className={styles.receiptTotalFooter}>
                    <div className={styles.receiptTotalDivider} />
                    <div className={styles.receiptTotalRow}>
                      <span className={styles.receiptTotalLabel}>TOTAL</span>
                      <span className={styles.receiptTotalValue}>{formatCurrency(selectedSale.total)}</span>
                    </div>
                  </div>

                  {cancelError && (
                    <div className={styles.cancelError}>
                      <AlertCircle size={14} />{cancelError}
                    </div>
                  )}

                  {selectedSale.status === "COMPLETED" && (
                    <div className={styles.modalActions}>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={handleCancel}
                        disabled={cancelling}
                      >
                        {cancelling
                          ? <><Loader2 size={15} className={tableStyles.spinner} /> Anulando…</>
                          : <><Ban size={15} /> Anular venta</>
                        }
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
