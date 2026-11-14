"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/src/shared/components/Header"
import { Search, Package, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Warehouse, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import type { Product } from "@/src/shared/types"
import styles from "./StockPage.module.css"

const PAGE_SIZE = 50

export function StockPage() {
  const { accessToken } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"all" | "low" | "normal">("all")
  const [activeOnly, setActiveOnly] = useState(false)
  const [queryApplied, setQueryApplied] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [stockSummary, setStockSummary] = useState({ total: 0, lowStock: 0, normalStock: 0 })
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [adjustType, setAdjustType] = useState<"add" | "remove">("add")
  const [adjustQuantity, setAdjustQuantity] = useState("")
  const [submittingAdjust, setSubmittingAdjust] = useState(false)

  const fetchProducts = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (activeTab === "low") params.set("stockStatus", "LOW")
      if (activeTab === "normal") params.set("stockStatus", "NORMAL")
      if (activeOnly) params.set("isActive", "true")

      const res = await fetch(`${API_BASE_URL}/product?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal,
      })
      if (!res.ok) throw new Error("Error al cargar productos del inventario")
      const data = await res.json()
      if (!signal.aborted) {
        setProducts(data.items ?? data)
        setTotal(data.total ?? 0)
      }
    } catch (err: any) {
      if (!signal.aborted) setError(err.message)
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [accessToken, page, debouncedSearch, activeTab, activeOnly])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("stockStatus") === "LOW") setActiveTab("low")
    if (params.get("stockStatus") === "NORMAL") setActiveTab("normal")
    setActiveOnly(params.get("isActive") === "true")
    setQueryApplied(true)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (!accessToken || !queryApplied || searchQuery.trim() !== debouncedSearch) return
    const controller = new AbortController()
    void fetchProducts(controller.signal)
    return () => controller.abort()
  }, [accessToken, queryApplied, searchQuery, debouncedSearch, fetchProducts])

  useEffect(() => {
    if (!accessToken) return
    const controller = new AbortController()
    const loadSummary = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/product/stock-summary`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("Error al cargar el resumen del inventario")
        const summary = await res.json()
        if (!controller.signal.aborted) setStockSummary(summary)
      } catch (err) {
        if (!controller.signal.aborted) console.error(err)
      }
    }
    void loadSummary()
    return () => controller.abort()
  }, [accessToken])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleAdjustStock = async () => {
    if (!adjustProduct || !adjustQuantity || !accessToken) return

    setSubmittingAdjust(true)
    const qty = Number.parseInt(adjustQuantity)
    const newStock = adjustType === "add" ? adjustProduct.stock + qty : Math.max(0, adjustProduct.stock - qty)
    const stockNotes = adjustType === "add" ? `Entrada manual de stock: +${qty}` : `Salida manual de stock: -${qty}`

    try {
      const res = await fetch(`${API_BASE_URL}/product/${adjustProduct.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          stock: newStock,
          stockNotes,
        }),
      })

      if (!res.ok) throw new Error("Error al guardar el ajuste de stock en el servidor")
      const updated = await res.json()
      
      setProducts((current) => current.map((p) => (p.id === adjustProduct.id ? { ...p, stock: updated.stock } : p)))
      setStockSummary((current) => {
        const wasLow = adjustProduct.stock <= adjustProduct.stockMinimum
        const isLow = updated.stock <= adjustProduct.stockMinimum
        return {
          ...current,
          lowStock: current.lowStock + Number(isLow) - Number(wasLow),
          normalStock: current.normalStock + Number(!isLow) - Number(!wasLow),
        }
      })
      setAdjustProduct(null)
      setAdjustQuantity("")
    } catch (err: any) {
      alert(err.message || "Error al ajustar el stock")
    } finally {
      setSubmittingAdjust(false)
    }
  }

  const openAdjustDialog = (product: Product, type: "add" | "remove") => {
    setAdjustProduct(product)
    setAdjustType(type)
    setAdjustQuantity("")
  }

  return (
    <div className={styles.page}>
      <Header title="Gestión de Stock" />

      <div className={styles.container}>
        {/* Summary Cards */}
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryLabel}>Total Productos</span>
              <Package size={16} color="#64748b" />
            </div>
            <div className={styles.summaryValue}>{loading && stockSummary.total === 0 ? "..." : stockSummary.total}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryLabel}>Stock Bajo</span>
              <AlertTriangle size={16} color="#f59e0b" />
            </div>
            <div className={`${styles.summaryValue} ${styles.summaryValueWarning}`}>
              {loading && stockSummary.total === 0 ? "..." : stockSummary.lowStock}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryLabel}>Stock Normal</span>
              <Warehouse size={16} color="#64748b" />
            </div>
            <div className={`${styles.summaryValue} ${styles.summaryValueSuccess}`}>
              {loading && stockSummary.total === 0 ? "..." : stockSummary.normalStock}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className={styles.searchInput}
            disabled={loading}
          />
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tabButton} ${activeTab === "all" ? styles.tabButtonActive : ""}`}
            onClick={() => { setActiveTab("all"); setPage(1) }}
            disabled={loading}
          >
            Todos ({stockSummary.total})
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "low" ? styles.tabButtonActive : ""} ${styles.tabButtonWarning}`}
            onClick={() => { setActiveTab("low"); setPage(1) }}
            disabled={loading}
          >
            Stock Bajo ({stockSummary.lowStock})
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "normal" ? styles.tabButtonActive : ""}`}
            onClick={() => { setActiveTab("normal"); setPage(1) }}
            disabled={loading}
          >
            Stock Normal ({stockSummary.normalStock})
          </button>
        </div>

        {/* Table / Loader */}
        {loading && products.length === 0 ? (
          <div className={styles.loadingWrapper} style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <Loader2 className={styles.spinner} size={32} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : error ? (
          <div className={styles.errorWrapper} style={{ color: "red", textAlign: "center", padding: "2rem" }}>
            {error}
          </div>
        ) : (
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead className={styles.tableHeader}>
                <tr>
                  <th className={styles.tableHeaderCell}>Producto</th>
                  <th className={styles.tableHeaderCell}>Código</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellCenter}`}>Stock Actual</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellCenter}`}>Stock Mínimo</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellCenter}`}>Estado</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className={styles.emptyState}>
                        <Package size={32} />
                        <p>No se encontraron productos</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const isLowStock = product.stock <= product.stockMinimum
                    return (
                      <tr key={product.id} className={styles.tableRow}>
                        <td className={styles.tableCell}>
                          <div className={styles.productCell}>
                            <div className={styles.productIcon}>
                              <Package size={20} />
                            </div>
                            <span>{product.name}</span>
                          </div>
                        </td>
                        <td className={styles.tableCell}>{product.barcode || "-"}</td>
                        <td className={`${styles.tableCell} ${styles.tableCellCenter}`}>
                          <span className={`${styles.stockValue} ${isLowStock ? styles.stockValueWarning : ""}`}>
                            {product.stock}
                          </span>
                        </td>
                        <td className={`${styles.tableCell} ${styles.tableCellCenter}`}>{product.stockMinimum}</td>
                        <td className={`${styles.tableCell} ${styles.tableCellCenter}`}>
                          {isLowStock ? (
                            <span className={`${styles.badge} ${styles.badgeWarning}`}>
                              <AlertTriangle size={12} />
                              Stock bajo
                            </span>
                          ) : (
                            <span className={`${styles.badge} ${styles.badgeSuccess}`}>Normal</span>
                          )}
                        </td>
                        <td className={`${styles.tableCell} ${styles.tableCellRight}`}>
                          <div className={styles.actionButtons}>
                            <button className={styles.entryButton} onClick={() => openAdjustDialog(product, "add")}>
                              <ArrowUpCircle size={14} color="#22c55e" />
                              Entrada
                            </button>
                            <button className={styles.exitButton} onClick={() => openAdjustDialog(product, "remove")}>
                              <ArrowDownCircle size={14} color="#ef4444" />
                              Salida
                            </button>
                          </div>
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
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
                </span>
                <div className={styles.paginationControls}>
                  <button type="button" className={styles.pageButton} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                    <ChevronLeft size={15} />
                  </button>
                  <span>Página {page} de {totalPages}</span>
                  <button type="button" className={styles.pageButton} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {adjustProduct && (
        <div className={styles.modalOverlay} onClick={() => setAdjustProduct(null)}>
          <div data-pos-modal className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{adjustType === "add" ? "Entrada de Stock" : "Salida de Stock"}</h2>
              <p className={styles.modalDescription}>
                {adjustProduct.name} - Stock actual: {adjustProduct.stock}
              </p>
            </div>

            <div className={styles.modalContent}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Cantidad</label>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  placeholder="Ingresa la cantidad"
                  disabled={submittingAdjust}
                />
              </div>

              {adjustQuantity && (
                <div className={styles.previewBox}>
                  <p className={styles.previewText}>
                    Nuevo stock:{" "}
                    <span className={styles.previewValue}>
                      {adjustType === "add"
                        ? adjustProduct.stock + Number.parseInt(adjustQuantity || "0")
                        : Math.max(0, adjustProduct.stock - Number.parseInt(adjustQuantity || "0"))}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelButton} onClick={() => setAdjustProduct(null)} disabled={submittingAdjust}>
                Cancelar
              </button>
              <button
                className={styles.submitButton}
                onClick={handleAdjustStock}
                disabled={!adjustQuantity || Number.parseInt(adjustQuantity) <= 0 || submittingAdjust}
              >
                {submittingAdjust ? "Guardando..." : adjustType === "add" ? "Registrar entrada" : "Registrar salida"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
