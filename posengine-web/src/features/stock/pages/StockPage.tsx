"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/src/shared/components/Header"
import { Search, Package, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Warehouse, Loader2 } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import type { Product } from "@/src/shared/types"
import styles from "./StockPage.module.css"

export function StockPage() {
  const { accessToken } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"all" | "low" | "normal">("all")
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [adjustType, setAdjustType] = useState<"add" | "remove">("add")
  const [adjustQuantity, setAdjustQuantity] = useState("")
  const [submittingAdjust, setSubmittingAdjust] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/product?limit=1000`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!res.ok) throw new Error("Error al cargar productos del inventario")
      const data = await res.json()
      setProducts(data.items ?? data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (accessToken) {
      fetchProducts()
    }
  }, [accessToken, fetchProducts])

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) || product.barcode?.includes(searchQuery),
  )

  const lowStockProducts = filteredProducts.filter((p) => p.stock <= p.stockMinimum)
  const normalStockProducts = filteredProducts.filter((p) => p.stock > p.stockMinimum)

  const displayProducts =
    activeTab === "low" ? lowStockProducts : activeTab === "normal" ? normalStockProducts : filteredProducts

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
      
      setProducts(products.map((p) => (p.id === adjustProduct.id ? { ...p, stock: updated.stock } : p)))
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
            <div className={styles.summaryValue}>{loading ? "..." : products.length}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryLabel}>Stock Bajo</span>
              <AlertTriangle size={16} color="#f59e0b" />
            </div>
            <div className={`${styles.summaryValue} ${styles.summaryValueWarning}`}>
              {loading ? "..." : products.filter((p) => p.stock <= p.stockMinimum).length}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryLabel}>Stock Normal</span>
              <Warehouse size={16} color="#64748b" />
            </div>
            <div className={`${styles.summaryValue} ${styles.summaryValueSuccess}`}>
              {loading ? "..." : products.filter((p) => p.stock > p.stockMinimum).length}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            disabled={loading}
          />
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tabButton} ${activeTab === "all" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("all")}
            disabled={loading}
          >
            Todos ({loading ? 0 : filteredProducts.length})
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "low" ? styles.tabButtonActive : ""} ${styles.tabButtonWarning}`}
            onClick={() => setActiveTab("low")}
            disabled={loading}
          >
            Stock Bajo ({loading ? 0 : lowStockProducts.length})
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "normal" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("normal")}
            disabled={loading}
          >
            Stock Normal ({loading ? 0 : normalStockProducts.length})
          </button>
        </div>

        {/* Table / Loader */}
        {loading ? (
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
                {displayProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className={styles.emptyState}>
                        <Package size={32} />
                        <p>No se encontraron productos</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayProducts.map((product) => {
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
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {adjustProduct && (
        <div className={styles.modalOverlay} onClick={() => setAdjustProduct(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
