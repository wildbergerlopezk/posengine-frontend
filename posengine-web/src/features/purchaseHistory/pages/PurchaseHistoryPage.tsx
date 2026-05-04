"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Header } from "@/src/shared/components/Header"
import {
    Search, Eye, Package, AlertCircle, Loader2,
    X, ChevronLeft, ChevronRight, CheckCircle2,
    Clock, XCircle, CreditCard, Banknote, FileText,
    Hash, Calendar, Building2, Receipt, Tag, RotateCcw,
    ChevronDown, Ban
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
import styles from "./PurchaseHistoryPage.module.css"
import {
    Combobox,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxPopup,
    ComboboxTrigger,
    ComboboxValue,
} from "@/components/ui/combobox"
import { ConfirmDialog } from "@/src/shared/components/ConfirmDialog"
import { PurchaseReturnModal } from "../components/PurchaseReturnModal"

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL

// ─── Types ────────────────────────────────────────────────────────────────────

type PurchaseStatus = "RECEIVED" | "FULLY_RETURNED" | "CANCELLED"
type PurchasePaymentType = "CASH" | "CREDIT"

interface Supplier {
    id: string
    name: string
    RUC?: string
}

interface Product {
    id: string
    name: string
    barcode?: string
    sku?: string
    stock: number
}

interface PurchaseItem {
    id: string
    productId: string
    quantity: number
    unitCost: number
    total: number
    product: Product
    returnItems?: { quantity: number }[]
}

interface Purchase {
    id: string
    invoiceNumber: string
    purchaseDate: string
    paymentType: PurchasePaymentType
    status: PurchaseStatus
    total: number
    notes?: string
    createdAt: string
    supplier: Supplier
    items?: PurchaseItem[]
}

interface PaginatedResponse {
    items: Purchase[]
    total: number
    page: number
    limit: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PurchaseStatus, { label: string; icon: React.ReactNode; className: string }> = {
    RECEIVED: {
        label: "Recibida",
        icon: <CheckCircle2 size={12} />,
        className: styles.statusReceived,
    },
    FULLY_RETURNED: {
        label: "Devuelta",
        icon: <XCircle size={12} />,
        className: styles.statusCancelled,
    },
    CANCELLED: {
        label: "Cancelada",
        icon: <XCircle size={12} />,
        className: styles.statusCancelled,
    },
}

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("es-PY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PurchaseHistoryPage() {
    const { accessToken } = useAuthStore()
    const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
    }

    // ── List state ─────────────────────────────────────────────────────────────
    const [purchases, setPurchases] = useState<Purchase[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "ALL">("ALL")
    const [paymentFilter, setPaymentFilter] = useState<"CASH" | "CREDIT" | "ALL">("ALL")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [page, setPage] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const LIMIT = 10

    // ── Supplier filter state ──────────────────────────────────────────────────
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [selectedSupplier, setSelectedSupplier] = useState<{ label: string; value: string } | null>(null)
    const supplierId = selectedSupplier?.value || ""

    const supplierItems = [
        { label: "Todos los proveedores", value: "" },
        ...suppliers.map(s => ({ label: s.name, value: s.id }))
    ]

    // ── Detail modal state ─────────────────────────────────────────────────────
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [detailError, setDetailError] = useState<string | null>(null)

    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [showReturnModal, setShowReturnModal] = useState(false)
    const [cancelling, setCancelling] = useState(false)

    // ── Fetch list ─────────────────────────────────────────────────────────────
    const fetchPurchases = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(LIMIT),
            })
            if (search.trim())           params.set("search", search.trim())
            if (statusFilter !== "ALL")  params.set("status", statusFilter)
            if (paymentFilter !== "ALL") params.set("paymentType", paymentFilter)
            if (dateFrom)                params.set("dateFrom", dateFrom)
            if (dateTo)                  params.set("dateTo", dateTo)
            if (supplierId)              params.set("supplierId", supplierId)

            const res = await fetch(`${API_BASE}/purchases?${params}`, { headers: authHeaders })
            if (!res.ok) throw new Error("Error al cargar compras")
            const data: PaginatedResponse = await res.json()
            setPurchases(data.items ?? [])
            setTotalItems(data.total ?? 0)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setLoading(false)
        }
    }, [page, search, statusFilter, paymentFilter, dateFrom, dateTo, supplierId, accessToken])

    useEffect(() => {
        void fetchPurchases()
    }, [fetchPurchases])

    // Fetch suppliers once
    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const res = await fetch(`${API_BASE}/suppliers?limit=100`, { headers: authHeaders })
                if (res.ok) {
                    const data = await res.json()
                    setSuppliers(data.items || [])
                }
            } catch (err) { /* silent */ }
        }
        void fetchSuppliers()
    }, [accessToken])

    // Reset page on filter/search change
    useEffect(() => { setPage(1) }, [search, statusFilter, paymentFilter, dateFrom, dateTo, supplierId])

    // ── Helpers ────────────────────────────────────────────────────────────────
    const hasActiveFilters = statusFilter !== "ALL" || paymentFilter !== "ALL" || dateFrom || dateTo || search

    const clearFilters = () => {
        setSearch("")
        setStatusFilter("ALL")
        setPaymentFilter("ALL")
        setDateFrom("")
        setDateTo("")
        setSelectedSupplier(null)
    }

    // ── Open detail modal ──────────────────────────────────────────────────────
    const openDetail = async (purchase: Purchase) => {
        setSelectedPurchase({ ...purchase, items: undefined })
        setLoadingDetail(true)
        setDetailError(null)

        try {
            const res = await fetch(`${API_BASE}/purchases/${purchase.id}`, { headers: authHeaders })
            if (!res.ok) throw new Error("Error al cargar el detalle")
            const data: Purchase = await res.json()
            setSelectedPurchase(data)
        } catch (err) {
            setDetailError(err instanceof Error ? err.message : "Error al cargar detalle")
        } finally {
            setLoadingDetail(false)
        }
    }

    const closeDetail = () => {
        setSelectedPurchase(null)
        setDetailError(null)
    }

    // Esc to close modal
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeDetail() }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [])

    const handleCancelConfirm = async () => {
        if (!selectedPurchase) return
        
        setCancelling(true)
        try {
            const res = await fetch(`${API_BASE}/purchases/${selectedPurchase.id}/cancel`, {
                method: "PATCH",
                headers: authHeaders,
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Error al anular compra")
            }

            await fetchPurchases()
            setShowCancelConfirm(false)
            closeDetail()
        } catch (err) {
            alert(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setCancelling(false)
        }
    }

    const handleReturnSuccess = () => {
        setShowReturnModal(false)
        void fetchPurchases()
        closeDetail()
    }

    const totalPages = Math.ceil(totalItems / LIMIT)

    return (
        <div className={styles.page}>
            <Header title="Historial de compras" />

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

                <div className={styles.filtersBar}>
                    <div className={styles.filtersRow}>
                        <div className={styles.searchWrapper}>
                            <Search size={15} className={styles.searchIcon} />
                            <input
                                className={styles.searchInput}
                                placeholder="Buscar por factura, proveedor o RUC…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            {search && (
                                <button type="button" className={styles.searchClear} onClick={() => setSearch("")}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {hasActiveFilters || supplierId ? (
                            <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
                                <X size={13} /> Limpiar filtros
                            </button>
                        ) : null}
                    </div>

                    <div className={styles.filtersRow}>
                        <div className={styles.supplierFilter}>
                            <Combobox 
                                items={supplierItems} 
                                value={selectedSupplier} 
                                onValueChange={setSelectedSupplier}
                            >
                                <ComboboxTrigger className={styles.supplierComboboxTrigger}>
                                    <ComboboxValue placeholder="Todos los proveedores" />
                                    <ChevronDown size={14} className={styles.comboboxIcon} />
                                </ComboboxTrigger>
                                <ComboboxPopup>
                                    <ComboboxInput placeholder="Buscar proveedor..." />
                                    <ComboboxList>
                                        {(item) => (
                                            <ComboboxItem key={item.value} value={item}>
                                                {item.label}
                                            </ComboboxItem>
                                        )}
                                    </ComboboxList>
                                    <ComboboxEmpty>No se encontraron proveedores</ComboboxEmpty>
                                </ComboboxPopup>
                            </Combobox>
                        </div>

                        <div className={styles.statusTabs}>
                            {(["ALL", "RECEIVED", "FULLY_RETURNED", "CANCELLED"] as const).map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    className={`${styles.statusTab} ${statusFilter === s ? styles.statusTabActive : ""}`}
                                    onClick={() => setStatusFilter(s)}
                                >
                                    {s === "ALL" ? "Todos los estados" : STATUS_CONFIG[s].label}
                                </button>
                            ))}
                        </div>

                        <div className={styles.statusTabs}>
                            {(["ALL", "CASH", "CREDIT"] as const).map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    className={`${styles.statusTab} ${paymentFilter === p ? styles.statusTabActive : ""}`}
                                    onClick={() => setPaymentFilter(p)}
                                >
                                    {p === "ALL" ? "Todo pago" : p === "CASH" ? "Contado" : "Crédito"}
                                </button>
                            ))}
                        </div>

                        <div className={styles.dateRange}>
                            <input
                                type="date"
                                className={styles.dateInput}
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                title="Desde"
                            />
                            <span className={styles.dateSeparator}>→</span>
                            <input
                                type="date"
                                className={styles.dateInput}
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                title="Hasta"
                            />
                        </div>
                    </div>
                </div>

                <div className={tableStyles.tableCard}>
                    <div className={styles.tableToolbar}>
                        <span className={styles.tableTitle}>
                            Compras <span className={styles.tableCount}>{totalItems}</span>
                        </span>
                    </div>

                    <table className={`${tableStyles.table} ${styles.historyTable}`}>
                        <thead className={tableStyles.tableHeader}>
                            <tr>
                                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 180 }}>Nro. Factura</th>
                                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`}>Proveedor</th>
                                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 150 }}>Fecha</th>
                                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 110 }}>Pago</th>
                                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 120 }}>Estado</th>
                                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight} ${styles.headerCellOverride}`} style={{ width: 150 }}>Total</th>
                                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 70 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7}>
                                        <div className={tableStyles.emptyState}>
                                            <Loader2 size={28} className={tableStyles.spinner} />
                                        </div>
                                    </td>
                                </tr>
                            ) : purchases.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
                                        <div className={tableStyles.emptyState}>
                                            <Package size={36} className={tableStyles.emptyStateIcon} />
                                            <p className={tableStyles.emptyStateTitle}>Sin compras registradas</p>
                                            <p>No se encontraron compras con los filtros seleccionados</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                purchases.map(purchase => {
                                    const sc = STATUS_CONFIG[purchase.status]
                                    return (
                                        <tr key={purchase.id} className={tableStyles.tableRow}>
                                            <td className={tableStyles.tableCell}>
                                                <span className={styles.invoiceChip}>{purchase.invoiceNumber}</span>
                                            </td>
                                            <td className={tableStyles.tableCell}>
                                                <div className={styles.supplierCell}>
                                                    <span className={styles.supplierName}>{purchase.supplier.name}</span>
                                                    {purchase.supplier.RUC && (
                                                        <span className={styles.supplierRuc}>RUC: {purchase.supplier.RUC}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={tableStyles.tableCell}>
                                                <span className={styles.dateText}>{formatDateTime(purchase.purchaseDate)}</span>
                                            </td>
                                            <td className={tableStyles.tableCell}>
                                                <span className={`${styles.paymentBadge} ${purchase.paymentType === "CASH" ? styles.paymentCash : styles.paymentCredit}`}>
                                                    {purchase.paymentType === "CASH"
                                                        ? <><Banknote size={12} /> Contado</>
                                                        : <><CreditCard size={12} /> Crédito</>
                                                    }
                                                </span>
                                            </td>
                                            <td className={tableStyles.tableCell}>
                                                <span className={`${styles.statusBadge} ${sc.className}`}>
                                                    {sc.icon}
                                                    {sc.label}
                                                </span>
                                            </td>
                                            <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                                                <strong className={styles.totalAmount}>{formatCurrency(purchase.total)}</strong>
                                            </td>
                                            <td className={tableStyles.tableCell}>
                                                <button
                                                    type="button"
                                                    className={styles.viewBtn}
                                                    onClick={() => openDetail(purchase)}
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
                                    disabled={page === totalPages}
                                >
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectedPurchase && (
                <div className={tableStyles.modalOverlay} onClick={closeDetail}>
                    <div className={styles.detailModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.detailModalHeader}>
                            <div className={styles.detailModalHeaderLeft}>
                                <Receipt size={18} className={styles.detailModalIcon} />
                                <div>
                                    <h2 className={styles.detailModalTitle}>Detalle de compra</h2>
                                </div>
                            </div>
                            <button type="button" className={styles.modalCloseBtn} onClick={closeDetail}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.detailModalBody}>
                            <div className={styles.receiptHeader}>
                                <div className={styles.receiptHeaderGrid}>
                                    <div className={styles.receiptInfoBlock}>
                                        <div className={styles.receiptInfoRow}>
                                            <Building2 size={14} className={styles.receiptInfoIcon} />
                                            <div>
                                                <span className={styles.receiptInfoLabel}>Proveedor</span>
                                                <span className={styles.receiptInfoValue}>{selectedPurchase.supplier.name}</span>
                                                {selectedPurchase.supplier.RUC && (
                                                    <span className={styles.receiptInfoSub}>RUC: {selectedPurchase.supplier.RUC}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.receiptInfoBlock}>
                                        <div className={styles.receiptInfoRow}>
                                            <Hash size={14} className={styles.receiptInfoIcon} />
                                            <div>
                                                <span className={styles.receiptInfoLabel}>Nro. Factura</span>
                                                <span className={`${styles.receiptInfoValue} ${styles.receiptInvoiceNumber}`}>
                                                    {selectedPurchase.invoiceNumber}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.receiptInfoBlock}>
                                        <div className={styles.receiptInfoRow}>
                                            <Calendar size={14} className={styles.receiptInfoIcon} />
                                            <div>
                                                <span className={styles.receiptInfoLabel}>Fecha</span>
                                                <span className={styles.receiptInfoValue}>{formatDateTime(selectedPurchase.purchaseDate)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.receiptInfoBlock}>
                                        <div className={styles.receiptInfoRow}>
                                            <Tag size={14} className={styles.receiptInfoIcon} />
                                            <div>
                                                <span className={styles.receiptInfoLabel}>Estado</span>
                                                <span className={`${styles.statusBadge} ${STATUS_CONFIG[selectedPurchase.status].className}`}>
                                                    {STATUS_CONFIG[selectedPurchase.status].icon}
                                                    {STATUS_CONFIG[selectedPurchase.status].label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.receiptInfoBlock}>
                                        <div className={styles.receiptInfoRow}>
                                            {selectedPurchase.paymentType === "CASH"
                                                ? <Banknote size={14} className={styles.receiptInfoIcon} />
                                                : <CreditCard size={14} className={styles.receiptInfoIcon} />
                                            }
                                            <div>
                                                <span className={styles.receiptInfoLabel}>Tipo de pago</span>
                                                <span className={styles.receiptInfoValue}>
                                                    {selectedPurchase.paymentType === "CASH" ? "Contado" : "Crédito"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {selectedPurchase.notes && (
                                        <div className={`${styles.receiptInfoBlock} ${styles.receiptInfoBlockFull}`}>
                                            <div className={styles.receiptInfoRow}>
                                                <FileText size={14} className={styles.receiptInfoIcon} />
                                                <div>
                                                    <span className={styles.receiptInfoLabel}>Observación</span>
                                                    <span className={styles.receiptInfoValue}>{selectedPurchase.notes}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.receiptItemsSection}>
                                <div className={styles.receiptItemsTitle}>
                                    <Package size={14} />
                                    Productos
                                    {selectedPurchase.items && (
                                        <span className={styles.receiptItemsCount}>{selectedPurchase.items.length}</span>
                                    )}
                                </div>

                                {loadingDetail ? (
                                    <div className={styles.detailLoading}>
                                        <Loader2 size={22} className={tableStyles.spinner} />
                                        <span>Cargando productos…</span>
                                    </div>
                                ) : detailError ? (
                                    <div className={styles.detailError}>
                                        <AlertCircle size={16} />
                                        {detailError}
                                    </div>
                                ) : (
                                    <table className={styles.receiptTable}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 40 }}>#</th>
                                                <th style={{ width: 120 }}>Código</th>
                                                <th>Descripción</th>
                                                <th style={{ width: 80, textAlign: "right" }}>Cant.</th>
                                                <th style={{ width: 130, textAlign: "right" }}>Costo unit.</th>
                                                <th style={{ width: 130, textAlign: "right" }}>Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedPurchase.items ?? []).map((item, idx) => (
                                                <tr key={item.id}>
                                                    <td className={styles.receiptTableNum}>{idx + 1}</td>
                                                    <td>
                                                        <span className={styles.codeChip}>
                                                            {item.product.barcode || item.product.sku || "—"}
                                                        </span>
                                                    </td>
                                                    <td className={styles.receiptTableName}>{item.product.name}</td>
                                                    <td className={styles.receiptTableRight}>{item.quantity}</td>
                                                    <td className={styles.receiptTableRight}>{formatCurrency(item.unitCost)}</td>
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
                                            <span className={styles.receiptTotalLabel}>TOTAL A PAGAR</span>
                                            <span className={styles.receiptTotalValue}>{formatCurrency(selectedPurchase.total)}</span>
                                        </div>
                                    </div>

                                    {selectedPurchase.status === "RECEIVED" && (
                                        <div className={styles.modalActions}>
                                            <button
                                                type="button"
                                                className={styles.cancelBtn}
                                                onClick={() => setShowCancelConfirm(true)}
                                                disabled={cancelling}
                                            >
                                                {cancelling ? <Loader2 size={16} className={tableStyles.spinner} /> : <Ban size={16} />}
                                                Anular Factura
                                            </button>

                                            <button
                                                type="button"
                                                className={styles.returnBtn}
                                                onClick={() => setShowReturnModal(true)}
                                            >
                                                <RotateCcw size={16} />
                                                Registrar Devolución
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={showCancelConfirm}
                title="Anular Factura"
                message="¿Estás seguro de que deseas anular esta compra? Esta acción revertirá completamente el stock de todos los productos ingresados y no se puede deshacer."
                confirmText="Anular Factura"
                cancelText="Cerrar"
                type="danger"
                loading={cancelling}
                onConfirm={handleCancelConfirm}
                onCancel={() => setShowCancelConfirm(false)}
            />

            {selectedPurchase && (
                <PurchaseReturnModal
                    open={showReturnModal}
                    purchase={selectedPurchase}
                    loading={false}
                    onClose={() => setShowReturnModal(false)}
                    onSuccess={handleReturnSuccess}
                />
            )}
        </div>
    )
}