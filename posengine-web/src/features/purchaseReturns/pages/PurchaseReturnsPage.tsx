"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Header } from "@/src/shared/components/Header"
import { usePathname } from "next/navigation"
import {
    Search,
    RotateCcw,
    Eye,
    X,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Loader2,
} from "lucide-react"
import styles from "./PurchaseReturnsPage.module.css"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL

// ── Helpers ──────────────────────────────────────────────────────────────
function readApiError(body: unknown): string {
    if (!body || typeof body !== "object") return "Error en la solicitud"
    const b = body as { message?: unknown; error?: string }
    if (Array.isArray(b.message)) return b.message.map(String).join(" · ")
    if (typeof b.message === "string") return b.message
    if (typeof b.error === "string") return b.error
    return "Error en la solicitud"
}

// ── Types ──────────────────────────────────────────────────────────────────
type ReturnStatus = "PENDING" | "CONFIRMED" | "CANCELLED"

interface Product {
    id: string
    name: string
    sku?: string
    barcode?: string
}

interface ReturnItem {
    id: string
    productId: string
    quantity: number
    unitCost: number
    total: number
    product: Product
}

interface PurchaseReturn {
    id: string
    status: ReturnStatus
    returnDate: string
    reason?: string
    creditNoteNumber?: string
    total: number
    createdAt: string
    purchase: {
        invoiceNumber: string
        purchaseDate: string
        supplier: {
            name: string
            RUC?: string
        }
    }
    items: ReturnItem[]
}

const STATUS_CONFIG: Record<ReturnStatus, { label: string; icon: React.ReactNode; className: string }> = {
    PENDING: {
        label: "Pendiente",
        icon: <Clock size={12} />,
        className: styles.statusPending,
    },
    CONFIRMED: {
        label: "Confirmada",
        icon: <CheckCircle2 size={12} />,
        className: styles.statusConfirmed,
    },
    CANCELLED: {
        label: "Cancelada",
        icon: <XCircle size={12} />,
        className: styles.statusCancelled,
    },
}

export function PurchaseReturnsPage() {
    const { accessToken } = useAuthStore()
    const pathname = usePathname()

    // ── List State ─────────────────────────────────────────────────────────────
    const [returns, setReturns] = useState<PurchaseReturn[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // ── Filter State ───────────────────────────────────────────────────────────
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<ReturnStatus | "ALL">("ALL")

    // ── Detail State ───────────────────────────────────────────────────────────
    const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null)
    const [detail, setDetail] = useState<PurchaseReturn | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [cancelling, setCancelling] = useState(false)

    // ── Fetch Data ─────────────────────────────────────────────────────────────
    const fetchReturns = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`${API_BASE}/purchase-returns`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            })
            if (!res.ok) throw new Error("Error al cargar devoluciones")
            const data = await res.json()
            setReturns(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setLoading(false)
        }
    }, [accessToken])

    useEffect(() => {
        fetchReturns()
    }, [fetchReturns])

    const fetchDetail = useCallback(async (id: string) => {
        setLoadingDetail(true)
        try {
            const res = await fetch(`${API_BASE}/purchase-returns/${id}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            })
            if (!res.ok) throw new Error("Error al cargar el detalle")
            const data = await res.json()
            setDetail(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingDetail(false)
        }
    }, [accessToken])

    useEffect(() => {
        if (selectedReturnId) {
            fetchDetail(selectedReturnId)
        } else {
            setDetail(null)
        }
    }, [selectedReturnId, fetchDetail])

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleConfirm = async () => {
        if (!detail || confirming) return
        if (!window.confirm("¿Estás seguro de confirmar esta devolución? Esto descontará el stock de los productos.")) return

        setConfirming(true)
        try {
            const res = await fetch(`${API_BASE}/purchase-returns/${detail.id}/confirm`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${accessToken}` },
            })
            if (!res.ok) {
                const body = await res.json()
                throw new Error(readApiError(body))
            }
            // Actualizar lista y cerrar modal
            await fetchReturns()
            setSelectedReturnId(null)
        } catch (err) {
            alert(err instanceof Error ? err.message : "Error al confirmar")
        } finally {
            setConfirming(false)
        }
    }

    const handleCancel = async () => {
        if (!detail || cancelling) return
        if (!window.confirm("¿Estás seguro de cancelar esta devolución?")) return

        setCancelling(true)
        try {
            const res = await fetch(`${API_BASE}/purchase-returns/${detail.id}/cancel`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${accessToken}` },
            })
            if (!res.ok) {
                const body = await res.json()
                throw new Error(readApiError(body))
            }
            await fetchReturns()
            setSelectedReturnId(null)
        } catch (err) {
            alert(err instanceof Error ? err.message : "Error al cancelar")
        } finally {
            setCancelling(false)
        }
    }

    // ── Filtered Data ──────────────────────────────────────────────────────────
    const filteredReturns = returns.filter(r => {
        const matchesStatus = statusFilter === "ALL" || r.status === statusFilter
        const searchLower = search.toLowerCase()
        const matchesSearch = !search ||
            r.purchase.invoiceNumber.toLowerCase().includes(searchLower) ||
            r.purchase.supplier.name.toLowerCase().includes(searchLower) ||
            (r.creditNoteNumber && r.creditNoteNumber.toLowerCase().includes(searchLower))

        return matchesStatus && matchesSearch
    })

    return (
        <div className={styles.page}>
            <Header title="Devoluciones de Compra" />

            <main className={styles.container}>
                {/* ── Filters ── */}
                <div className={styles.filtersBar}>
                    <div className={styles.filtersRow}>
                        <div className={styles.searchWrapper}>
                            <Search className={styles.searchIcon} size={16} />
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Buscar por factura, proveedor o NC..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            {search && (
                                <button className={styles.searchClear} onClick={() => setSearch("")}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className={styles.statusTabs}>
                            <button
                                className={`${styles.statusTab} ${statusFilter === "ALL" ? styles.statusTabActive : ""}`}
                                onClick={() => setStatusFilter("ALL")}
                            >
                                Todas
                            </button>
                            <button
                                className={`${styles.statusTab} ${statusFilter === "PENDING" ? styles.statusTabActive : ""}`}
                                onClick={() => setStatusFilter("PENDING")}
                            >
                                Pendientes
                            </button>
                            <button
                                className={`${styles.statusTab} ${statusFilter === "CONFIRMED" ? styles.statusTabActive : ""}`}
                                onClick={() => setStatusFilter("CONFIRMED")}
                            >
                                Confirmadas
                            </button>
                            <button
                                className={`${styles.statusTab} ${statusFilter === "CANCELLED" ? styles.statusTabActive : ""}`}
                                onClick={() => setStatusFilter("CANCELLED")}
                            >
                                Canceladas
                            </button>
                        </div>

                        {(search || statusFilter !== "ALL") && (
                            <button
                                className={styles.clearFiltersBtn}
                                onClick={() => { setSearch(""); setStatusFilter("ALL") }}
                            >
                                <X size={14} /> Limpiar filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Table ── */}
                <div className={tableStyles.tableContainer}>
                    <div className={styles.tableToolbar}>
                        <div className={styles.tableTitle}>
                            Listado de Devoluciones
                            <span className={styles.tableCount}>{filteredReturns.length} registros</span>
                        </div>
                    </div>

                    <table className={tableStyles.table}>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Factura Original</th>
                                <th>Proveedor</th>
                                <th>Nota de Crédito</th>
                                <th>Estado</th>
                                <th style={{ textAlign: "right" }}>Total</th>
                                <th style={{ textAlign: "center" }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: "center", padding: "3rem" }}>
                                        <Loader2 className="animate-spin" size={24} style={{ margin: "0 auto", color: "var(--color-primary)" }} />
                                        <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--color-muted-foreground)" }}>Cargando devoluciones...</p>
                                    </td>
                                </tr>
                            ) : filteredReturns.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: "center", padding: "3rem" }}>
                                        <AlertCircle size={24} style={{ margin: "0 auto", color: "var(--color-muted-foreground)", opacity: 0.5 }} />
                                        <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--color-muted-foreground)" }}>No se encontraron devoluciones</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredReturns.map(r => {
                                    const config = STATUS_CONFIG[r.status]
                                    return (
                                        <tr key={r.id}>
                                            <td className={styles.dateText}>
                                                {new Date(r.returnDate).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <span className={styles.invoiceChip}>{r.purchase.invoiceNumber}</span>
                                            </td>
                                            <td>
                                                <div className={styles.supplierCell}>
                                                    <span className={styles.supplierName}>{r.purchase.supplier.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {r.creditNoteNumber ? (
                                                    <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>{r.creditNoteNumber}</span>
                                                ) : (
                                                    <span style={{ fontSize: "0.75rem", color: "var(--color-muted-foreground)", fontStyle: "italic" }}>Sin NC</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${config.className}`}>
                                                    {config.icon}
                                                    {config.label}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: "right", fontWeight: 600 }}>
                                                {formatCurrency(r.total)}
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", justifyContent: "center" }}>
                                                    <button
                                                        className={styles.viewBtn}
                                                        onClick={() => setSelectedReturnId(r.id)}
                                                        title="Ver detalle"
                                                    >
                                                        <Eye size={16} />
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
            </main>

            {/* ── Detail Modal ── */}
            {selectedReturnId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedReturnId(null)}>
                    <div className={styles.detailModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.detailModalHeader}>
                            <div className={styles.detailModalHeaderLeft}>
                                <RotateCcw className={styles.detailModalIcon} size={20} />
                                <h2 className={styles.detailModalTitle}>Detalle de Devolución</h2>
                            </div>
                            <button className={styles.modalCloseBtn} onClick={() => setSelectedReturnId(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.detailModalBody}>
                            {loadingDetail ? (
                                <div className={styles.detailLoading}>
                                    <Loader2 className="animate-spin" size={32} />
                                    <span>Cargando información...</span>
                                </div>
                            ) : detail ? (
                                <>
                                    <div className={styles.receiptHeader}>
                                        <div className={styles.receiptHeaderGrid}>
                                            <div className={styles.receiptInfoBlock}>
                                                <span className={styles.receiptInfoLabel}>Factura Original</span>
                                                <span className={`${styles.receiptInfoValue} ${styles.receiptInvoiceNumber}`}>
                                                    {detail.purchase.invoiceNumber}
                                                </span>
                                                <span className={styles.receiptInfoSub}>
                                                    Fecha Compra: {new Date(detail.purchase.purchaseDate).toLocaleDateString()}
                                                </span>
                                            </div>

                                            <div className={styles.receiptInfoBlock}>
                                                <span className={styles.receiptInfoLabel}>Proveedor</span>
                                                <span className={styles.receiptInfoValue}>{detail.purchase.supplier.name}</span>
                                                <span className={styles.receiptInfoSub}>RUC: {detail.purchase.supplier.RUC || "N/A"}</span>
                                            </div>

                                            <div className={styles.receiptInfoBlock}>
                                                <span className={styles.receiptInfoLabel}>Fecha Devolución</span>
                                                <span className={styles.receiptInfoValue}>{new Date(detail.returnDate).toLocaleDateString()}</span>
                                            </div>

                                            <div className={styles.receiptInfoBlock}>
                                                <span className={styles.receiptInfoLabel}>Nota de Crédito</span>
                                                <span className={styles.receiptInfoValue}>{detail.creditNoteNumber || "No asignada"}</span>
                                            </div>

                                            {detail.reason && (
                                                <div className={styles.receiptInfoBlockFull}>
                                                    <span className={styles.receiptInfoLabel}>Motivo</span>
                                                    <span className={styles.receiptInfoValue} style={{ fontWeight: 400, fontSize: "0.85rem" }}>
                                                        {detail.reason}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className={styles.receiptItemsSection}>
                                        <h3 className={styles.receiptItemsTitle}>
                                            Productos Devueltos
                                            <span className={styles.receiptItemsCount}>{detail.items.length} items</span>
                                        </h3>

                                        <table className={styles.receiptTable}>
                                            <thead>
                                                <tr>
                                                    <th>Producto</th>
                                                    <th className={styles.receiptTableRight}>Cant.</th>
                                                    <th className={styles.receiptTableRight}>Costo Unit.</th>
                                                    <th className={styles.receiptTableRight}>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.items.map(item => (
                                                    <tr key={item.id}>
                                                        <td>
                                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                                <span className={styles.receiptTableName}>{item.product.name}</span>
                                                                <span className={styles.codeChip}>{item.product.sku || item.product.barcode || "Sin SKU"}</span>
                                                            </div>
                                                        </td>
                                                        <td className={styles.receiptTableRight}>{item.quantity}</td>
                                                        <td className={styles.receiptTableRight}>{formatCurrency(item.unitCost)}</td>
                                                        <td className={`${styles.receiptTableRight} ${styles.receiptTableSubtotal}`}>
                                                            {formatCurrency(item.total)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className={styles.receiptTotalFooter}>
                                        <div className={styles.receiptTotalDivider} />
                                        <div className={styles.receiptTotalRow}>
                                            <span className={styles.receiptTotalLabel}>TOTAL DEVOLUCIÓN</span>
                                            <span className={styles.receiptTotalValue}>{formatCurrency(detail.total)}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className={styles.detailError}>
                                    <AlertCircle size={32} />
                                    <span>No se pudo cargar la información</span>
                                </div>
                            )}
                        </div>

                        {detail && detail.status === "PENDING" && (
                            <div className={styles.modalFooterActions}>
                                <button
                                    className={styles.cancelReturnBtn}
                                    onClick={handleCancel}
                                    disabled={cancelling || confirming}
                                >
                                    {cancelling ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                                    Anular Devolución
                                </button>
                                <button
                                    className={styles.confirmReturnBtn}
                                    onClick={handleConfirm}
                                    disabled={cancelling || confirming}
                                >
                                    {confirming ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                    Confirmar y Ajustar Stock
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
