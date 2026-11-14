"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Header } from "@/src/shared/components/Header"
import {
    Search, Eye, Package, AlertCircle, Loader2,
    X, ChevronLeft, ChevronRight, CheckCircle2,
    Clock, XCircle, CreditCard, Banknote, FileText,
    Hash, Calendar, Building2, Receipt, Tag,
    ChevronDown, Ban
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { clearIdempotencyKey, prepareIdempotencyKey } from "@/src/shared/api/idempotency"
import { useCashSession } from "@/src/features/cash-session/hooks/useCashSession"
import { useCommercialCapabilities } from "@/src/shared/hooks/useCommercialCapabilities"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { API_BASE_URL } from "@/src/shared/config/api"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
import dataTableStyles from "@/src/shared/components/DataTable/DataTable.module.css"
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
import { DetailModalTabs, type DetailModalTab } from "@/src/shared/components/DetailModalTabs"
import layout from "@/src/shared/styles/DetailModalLayout.module.css"
import controls from "@/src/shared/styles/detailFormControls.module.css"
import { PurchaseReturnModal } from "../components/PurchaseReturnModal"
import { PurchaseReturnFinancePanel } from "../components/PurchaseReturnFinancePanel"

const API_BASE = API_BASE_URL

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

interface PurchaseDebtPayment {
    id: string
    amount: number
    paymentDate: string
    paymentMethod?: "CASH" | "TRANSFER" | null
    notes?: string
}

interface PurchaseDebtInstallment {
    id: string
    number: number
    amount: number
    paidAmount: number
    dueDate: string
    status: "PENDING" | "PARTIAL" | "PAID"
    adjustments?: { amount: number }[]
    creditApplications?: { amount: number }[]
}

const getInstallmentBalance = (installment: PurchaseDebtInstallment) => {
    const adjustments = (installment.adjustments ?? []).reduce((sum, row) => sum + Number(row.amount), 0)
    const credits = (installment.creditApplications ?? []).reduce((sum, row) => sum + Number(row.amount), 0)
    return Math.max(0, Number(installment.amount) - Number(installment.paidAmount) - adjustments - credits)
}

interface PurchaseDebt {
    id: string
    totalAmount: number
    paidAmount: number
    balance: number
    scheduleType: "NONE" | "OWNER_REMINDER" | "SUPPLIER_SCHEDULE"
    dueDate?: string
    status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED"
    installments: PurchaseDebtInstallment[]
    payments: PurchaseDebtPayment[]
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
    debt?: PurchaseDebt
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
    const { accessToken, user } = useAuthStore()
    const { session: activeCashSession, loading: cashSessionLoading } = useCashSession()
    const { capabilities, loading: capabilitiesLoading, error: capabilitiesError } = useCommercialCapabilities(accessToken ?? "")
    const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
    }

    // ── List state ─────────────────────────────────────────────────────────────
    const [purchases, setPurchases] = useState<Purchase[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
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
    const [cancelling, setCancelling] = useState(false)
    const [cancelReason, setCancelReason] = useState("")
    const [supplierReceivedNothing, setSupplierReceivedNothing] = useState(false)
    const [cancelPurchaseError, setCancelPurchaseError] = useState<string | null>(null)

    // ── Debt state ──────────────────────────────────────────────────────────────
    const [activeDetailTab, setActiveDetailTab] = useState<DetailModalTab>("summary")
    const [registeringPayment, setRegisteringPayment] = useState(false)
    const [paymentError, setPaymentError] = useState<string | null>(null)
    const [paymentAmount, setPaymentAmount] = useState("")
    const [paymentMethod, setPaymentMethod] = useState<"" | "CASH" | "TRANSFER">("")
    const [paymentNotes, setPaymentNotes] = useState("")
    const [paymentDateInput, setPaymentDateInput] = useState(() => new Date().toISOString().slice(0, 10))
    const [targetInstallmentId, setTargetInstallmentId] = useState("")

    const refreshSelectedPurchase = async () => {
        if (!selectedPurchase) return
        const response = await fetch(`${API_BASE}/purchases/${selectedPurchase.id}`, { headers: authHeaders })
        if (response.ok) setSelectedPurchase(await response.json())
    }

    // ── Fetch list ─────────────────────────────────────────────────────────────
    const fetchPurchases = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(LIMIT),
            })
            if (debouncedSearch)         params.set("search", debouncedSearch)
            if (statusFilter !== "ALL")  params.set("status", statusFilter)
            if (paymentFilter !== "ALL") params.set("paymentType", paymentFilter)
            if (dateFrom)                params.set("dateFrom", dateFrom)
            if (dateTo)                  params.set("dateTo", dateTo)
            if (supplierId)              params.set("supplierId", supplierId)

            const res = await fetch(`${API_BASE}/purchases?${params}`, { headers: authHeaders, signal })
            if (!res.ok) throw new Error("Error al cargar compras")
            const data: PaginatedResponse = await res.json()
            if (!signal?.aborted) {
                setPurchases(data.items ?? [])
                setTotalItems(data.total ?? 0)
            }
        } catch (err) {
            if (!signal?.aborted) setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [page, debouncedSearch, statusFilter, paymentFilter, dateFrom, dateTo, supplierId, accessToken])

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
        return () => clearTimeout(timer)
    }, [search])

    useEffect(() => {
        if (search.trim() !== debouncedSearch) return
        const controller = new AbortController()
        void fetchPurchases(controller.signal)
        return () => controller.abort()
    }, [fetchPurchases, search, debouncedSearch])

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
        setActiveDetailTab("summary")
        setPaymentAmount("")
        setPaymentMethod("")
        setPaymentNotes("")
        setTargetInstallmentId("")
        setPaymentError(null)
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
        if (cancelReason.trim().length < 5 || !supplierReceivedNothing) return
        
        setCancelling(true)
        setCancelPurchaseError(null)
        try {
            const res = await fetch(`${API_BASE}/purchases/${selectedPurchase.id}/cancel`, {
                method: "PATCH",
                headers: authHeaders,
                body: JSON.stringify({ reason: cancelReason.trim(), supplierReceivedNothing }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Error al anular compra")
            }

            await fetchPurchases()
            setShowCancelConfirm(false)
            closeDetail()
        } catch (err) {
            setCancelPurchaseError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setCancelling(false)
        }
    }

    const handleRegisterPayment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPurchase || !selectedPurchase.debt) return
        if (paymentMethod !== "CASH" && paymentMethod !== "TRANSFER") {
            setPaymentError("Seleccioná efectivo o transferencia como medio de pago.")
            return
        }
        if (paymentMethod === "CASH" && !activeCashSession) {
            setPaymentError("Abrí una caja para registrar un pago en efectivo.")
            return
        }
        const cleanAmount = paymentAmount.replace(/\D/g, "")
        const amountNum = parseFloat(cleanAmount)
        if (isNaN(amountNum) || amountNum <= 0) {
            setPaymentError("El importe debe ser mayor que cero.")
            return
        }
        if (amountNum > selectedPurchase.debt.balance + 0.01) {
            setPaymentError("El pago no puede superar el saldo pendiente.")
            return
        }

        setRegisteringPayment(true)
        setPaymentError(null)
        try {
            const payload = {
                amount: amountNum,
                paymentMethod,
                cashSessionId: activeCashSession?.id,
                paymentDate: new Date(paymentDateInput).toISOString(),
                installmentId: targetInstallmentId || undefined,
                notes: paymentNotes.trim() || undefined,
            }
            const operation = `PURCHASE_DEBT_PAYMENT:${selectedPurchase.id}`
            const idempotencyKey = await prepareIdempotencyKey(operation, user?.id ?? "", user?.tenantId, payload)
            const res = await fetch(`${API_BASE}/purchases/${selectedPurchase.id}/debt/payments`, {
                method: "POST",
                headers: { ...authHeaders, "Idempotency-Key": idempotencyKey },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                if (res.status >= 400 && res.status < 500 && res.status !== 409) clearIdempotencyKey(operation, user?.id ?? "", user?.tenantId)
                throw new Error(data.message || "Error al registrar el pago")
            }
            clearIdempotencyKey(operation, user?.id ?? "", user?.tenantId)

            // Reload detailed view
            const updatedPurchaseRes = await fetch(`${API_BASE}/purchases/${selectedPurchase.id}`, { headers: authHeaders })
            if (updatedPurchaseRes.ok) {
                const updatedPurchase = await updatedPurchaseRes.json()
                setSelectedPurchase(updatedPurchase)
            }
            // Clear payment input fields
            setPaymentAmount("")
            setPaymentMethod("")
            setPaymentNotes("")
            setTargetInstallmentId("")
            // Refresh main purchases history list
            await fetchPurchases()
        } catch (err) {
            setPaymentError(err instanceof Error ? err.message : "Error al registrar pago")
        } finally {
            setRegisteringPayment(false)
        }
    }

    const handleReturnSuccess = () => {
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

                <div className={dataTableStyles.historyResults}>
                    <div className={`${tableStyles.tableCard} ${dataTableStyles.historyCard}`}>
                        <div className={styles.tableToolbar}>
                            <span className={styles.tableTitle}>
                                Compras <span className={styles.tableCount}>{totalItems}</span>
                            </span>
                        </div>

                        <div className={dataTableStyles.viewport}>
                            <table className={`${tableStyles.table} ${dataTableStyles.naturalRows} ${dataTableStyles.compactCells} ${styles.historyTable}`}>
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
                        </div>

                        {totalPages > 1 && (
                            <div className={`${styles.pagination} ${dataTableStyles.fixedRegion}`}>
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
            </div>

            {selectedPurchase && (
                <div className={tableStyles.modalOverlay} onClick={closeDetail}>
                    <div data-pos-modal className={styles.detailModal} onClick={event => event.stopPropagation()}>
                        <header className={styles.detailModalHeader}>
                            <div className={styles.detailModalHeaderLeft}>
                                <Receipt size={18} className={styles.detailModalIcon} aria-hidden="true" />
                                <div>
                                    <h2 className={styles.detailModalTitle}>Detalle de compra</h2>
                                    <p className={styles.detailModalSubtitle}>Factura {selectedPurchase.invoiceNumber}</p>
                                </div>
                            </div>
                            <button type="button" className={styles.modalCloseBtn} onClick={closeDetail} aria-label="Cerrar detalle de compra">
                                <X size={18} aria-hidden="true" />
                            </button>
                        </header>

                        <DetailModalTabs id={`purchase-detail-${selectedPurchase.id.slice(0, 8)}`} value={activeDetailTab} onChange={setActiveDetailTab} disabled={loadingDetail || Boolean(detailError)} />

                        <div className={styles.detailModalBody}>
                            {loadingDetail ? (
                                <div className={styles.detailLoading}><Loader2 size={24} className={tableStyles.spinner} /> Cargando detalle…</div>
                            ) : detailError ? (
                                <div className={styles.detailError} role="alert"><AlertCircle size={16} />{detailError}</div>
                            ) : (
                                <>
                                    <section
                                        id={`purchase-detail-${selectedPurchase.id.slice(0, 8)}-summary-panel`}
                                        role="tabpanel"
                                        aria-labelledby={`purchase-detail-${selectedPurchase.id.slice(0, 8)}-summary-tab`}
                                        hidden={activeDetailTab !== "summary"}
                                        className={layout.tabPanel}
                                    >

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
                                    <Package size={14} aria-hidden="true" /> Productos originales
                                    <span className={styles.receiptItemsCount}>{selectedPurchase.items?.length ?? 0}</span>
                                </div>
                                <div className={styles.receiptTableWrapper}>
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
                                                    <td><span className={styles.codeChip}>{item.product.barcode || item.product.sku || "—"}</span></td>
                                                    <td className={styles.receiptTableName} title={item.product.name}>{item.product.name}</td>
                                                    <td className={styles.receiptTableRight}>{item.quantity}</td>
                                                    <td className={styles.receiptTableRight}>{formatCurrency(item.unitCost)}</td>
                                                    <td className={`${styles.receiptTableRight} ${styles.receiptTableSubtotal}`}>{formatCurrency(item.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {!loadingDetail && !detailError && selectedPurchase.debt && (
                                    <div className={styles.debtSection}>
                                        {/* Resumen Deuda Card */}
                                        <div className={styles.debtSummaryGrid}>
                                            <div className={styles.debtSummaryCard}>
                                                <span className={styles.debtSummaryLabel}>Total Deuda</span>
                                                <span className={styles.debtSummaryValue}>{formatCurrency(selectedPurchase.debt.totalAmount)}</span>
                                            </div>
                                            <div className={styles.debtSummaryCard}>
                                                <span className={styles.debtSummaryLabel}>Monto Abonado</span>
                                                <span className={`${styles.debtSummaryValue} ${styles.debtSummaryValuePaid}`}>{formatCurrency(selectedPurchase.debt.paidAmount)}</span>
                                            </div>
                                            <div className={styles.debtSummaryCard}>
                                                <span className={styles.debtSummaryLabel}>Saldo Pendiente</span>
                                                <span className={`${styles.debtSummaryValue} ${selectedPurchase.debt.balance > 0 ? styles.debtSummaryValuePending : styles.debtSummaryValueSettled}`}>
                                                    {formatCurrency(selectedPurchase.debt.balance)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Fila con Formulario y Listado */}
                                        <div className={styles.debtDetailsLayout}>
                                            {/* Columna Izquierda: Formulario Registrar Pago */}
                                            {selectedPurchase.debt.balance > 0 && selectedPurchase.status === "RECEIVED" && (
                                                <form className={styles.paymentFormCard} onSubmit={handleRegisterPayment}>
                                                    <h4 className={styles.paymentFormTitle}>Registrar Abono</h4>
                                                    
                                                    <div className={tableStyles.formGroup}>
                                                        <label className={tableStyles.label}>Monto a pagar</label>
                                                        <input
                                                            type="text"
                                                            className={tableStyles.input}
                                                            placeholder="Ej. 5.000"
                                                            value={paymentAmount}
                                                            onChange={e => {
                                                                setPaymentError(null)
                                                                const clean = e.target.value.replace(/\D/g, "")
                                                                setPaymentAmount(clean ? new Intl.NumberFormat("es-AR").format(parseInt(clean, 10)) : "")
                                                            }}
                                                            required
                                                        />
                                                    </div>

                                                    <div className={tableStyles.formGroup}>
                                                        <label className={tableStyles.label} htmlFor="supplier-debt-payment-method">Medio de pago</label>
                                                        <select
                                                            id="supplier-debt-payment-method"
                                                            className={tableStyles.input}
                                                            value={paymentMethod}
                                                            onChange={e => {
                                                                setPaymentError(null)
                                                                setPaymentMethod(e.target.value as "" | "CASH" | "TRANSFER")
                                                            }}
                                                            required
                                                        >
                                                            <option value="" disabled>Seleccionar medio de pago</option>
                                                            <option value="CASH">Efectivo</option>
                                                            <option value="TRANSFER">Transferencia</option>
                                                        </select>
                                                        {paymentMethod === "CASH" && !cashSessionLoading && !activeCashSession && (
                                                            <div className={styles.paymentFormError} role="alert">
                                                                Abrí una caja para registrar un pago en efectivo.
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className={tableStyles.formGroup}>
                                                        <label className={tableStyles.label}>Fecha Pago</label>
                                                        <input
                                                            type="date"
                                                            className={tableStyles.input}
                                                            value={paymentDateInput}
                                                            onChange={e => {
                                                                setPaymentError(null)
                                                                setPaymentDateInput(e.target.value)
                                                            }}
                                                            required
                                                        />
                                                    </div>

                                                    {selectedPurchase.debt.installments.length > 0 && (
                                                        <div className={tableStyles.formGroup}>
                                                            <label className={tableStyles.label}>Aplicar a cuota</label>
                                                            <select
                                                                className={tableStyles.input}
                                                                value={targetInstallmentId}
                                                                onChange={e => {
                                                                    setPaymentError(null)
                                                                    setTargetInstallmentId(e.target.value)
                                                                }}
                                                            >
                                                                <option value="">Automático (Orden FIFO)</option>
                                                                {selectedPurchase.debt.installments.map(inst => (
                                                                    <option 
                                                                        key={inst.id} 
                                                                        value={inst.id}
                                                                        disabled={getInstallmentBalance(inst) <= 0.01}
                                                                    >
                                                                        Cuota {inst.number} - {formatCurrency(getInstallmentBalance(inst))} pendiente
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}

                                                    <div className={tableStyles.formGroup}>
                                                        <label className={tableStyles.label}>Observación / Nota</label>
                                                        <input
                                                            type="text"
                                                            className={tableStyles.input}
                                                            placeholder="Ej. Transferencia Banco"
                                                            value={paymentNotes}
                                                            onChange={e => {
                                                                setPaymentError(null)
                                                                setPaymentNotes(e.target.value)
                                                            }}
                                                            maxLength={200}
                                                        />
                                                    </div>

                                                    {paymentError && (
                                                        <div className={styles.paymentFormError}>
                                                            <AlertCircle size={14} />
                                                            <span>{paymentError}</span>
                                                        </div>
                                                    )}

                                                    <button 
                                                        type="submit" 
                                                        className={styles.submitPaymentBtn}
                                                        disabled={registeringPayment || cashSessionLoading || !paymentMethod || (paymentMethod === "CASH" && !activeCashSession)}
                                                    >
                                                        {registeringPayment ? <Loader2 size={16} className={tableStyles.spinner} /> : null}
                                                        Registrar Pago
                                                    </button>
                                                </form>
                                            )}

                                            {/* Columna Derecha: Cronograma */}
                                            <div className={styles.scheduleCol}>
                                                <h4 className={styles.paymentFormTitle}>Cronograma de Pagos</h4>
                                                
                                                {selectedPurchase.debt.scheduleType === "NONE" ? (
                                                    <div className={styles.singleDueDateMsg}>
                                                        Pago único sin cuotas. 
                                                        {selectedPurchase.debt.dueDate ? (
                                                            <> Fecha límite: <strong>{new Date(selectedPurchase.debt.dueDate).toLocaleDateString()}</strong></>
                                                        ) : " Sin fecha límite."}
                                                    </div>
                                                ) : (
                                                    <div className={styles.installmentsTableWrapper}>
                                                        <table className={styles.debtTable}>
                                                            <thead>
                                                                <tr>
                                                                    <th>Cuota</th>
                                                                    <th>Vencimiento</th>
                                                                    <th style={{ textAlign: "right" }}>Pendiente</th>
                                                                    <th style={{ textAlign: "right" }}>Abonado</th>
                                                                    <th>Estado</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {selectedPurchase.debt.installments.map(inst => (
                                                                    <tr key={inst.id} className={inst.status === "PAID" ? styles.rowPaid : ""}>
                                                                        <td>Cuota {inst.number}</td>
                                                                        <td>{new Date(inst.dueDate).toLocaleDateString()}</td>
                                                                        <td style={{ textAlign: "right" }}>{formatCurrency(getInstallmentBalance(inst))}</td>
                                                                        <td style={{ textAlign: "right" }}>{formatCurrency(inst.paidAmount)}</td>
                                                                        <td>
                                                                            <span className={`${styles.badge} ${
                                                                                inst.status === "PAID" ? styles.badgePaid :
                                                                                inst.status === "PARTIAL" ? styles.badgePartial :
                                                                                styles.badgePending
                                                                            }`}>
                                                                                {inst.status === "PAID" ? "Pagada" : inst.status === "PARTIAL" ? "Parcial" : "Pendiente"}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                <h4 className={styles.paymentFormTitle} style={{ marginTop: "1.5rem" }}>Historial de Abonos</h4>
                                                {selectedPurchase.debt.payments.length === 0 ? (
                                                    <div className={styles.emptyPayments}>No se han registrado abonos todavía.</div>
                                                ) : (
                                                    <div className={styles.paymentsList}>
                                                        {selectedPurchase.debt.payments.map(pmt => (
                                                            <div key={pmt.id} className={styles.paymentItem}>
                                                                <div className={styles.paymentItemHeader}>
                                                                    <span className={styles.paymentItemDate}>
                                                                        {new Date(pmt.paymentDate).toLocaleDateString()}
                                                                    </span>
                                                                    <span className={styles.paymentItemAmount}>
                                                                        {formatCurrency(pmt.amount)} · {pmt.paymentMethod === "CASH" ? "Efectivo" : pmt.paymentMethod === "TRANSFER" ? "Transferencia" : "Sin clasificar"}
                                                                    </span>
                                                                </div>
                                                                {pmt.notes && <span className={styles.paymentItemNotes}>{pmt.notes}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                            )}

                            <div className={styles.receiptTotalFooter}>
                                <div className={styles.receiptTotalDivider} />
                                <div className={styles.receiptTotalRow}>
                                    <span className={styles.receiptTotalLabel}>TOTAL DE LA COMPRA</span>
                                    <span className={styles.receiptTotalValue}>{formatCurrency(selectedPurchase.total)}</span>
                                </div>
                            </div>
                                    </section>

                                    <section
                                        id={`purchase-detail-${selectedPurchase.id.slice(0, 8)}-returns-panel`}
                                        role="tabpanel"
                                        aria-labelledby={`purchase-detail-${selectedPurchase.id.slice(0, 8)}-returns-tab`}
                                        hidden={activeDetailTab !== "returns"}
                                        className={layout.tabPanel}
                                    >
                                        <PurchaseReturnModal
                                            key={`return-form-${selectedPurchase.id}`}
                                            inline
                                            open
                                            purchase={{
                                                id: selectedPurchase.id,
                                                invoiceNumber: selectedPurchase.invoiceNumber,
                                                supplier: selectedPurchase.supplier,
                                                paymentType: selectedPurchase.paymentType,
                                                debtBalance: selectedPurchase.debt?.balance ?? 0,
                                                total: selectedPurchase.total,
                                                items: selectedPurchase.items,
                                            }}
                                            loading={false}
                                            accessToken={accessToken ?? ""}
                                            cashSessionId={activeCashSession?.id}
                                            cashSessionLoading={cashSessionLoading}
                                            onSuccess={handleReturnSuccess}
                                        />
                                        <PurchaseReturnFinancePanel
                                            key={`return-history-${selectedPurchase.id}`}
                                            purchaseId={selectedPurchase.id}
                                            supplierId={selectedPurchase.supplier.id}
                                            supplierName={selectedPurchase.supplier.name}
                                            purchaseNumber={selectedPurchase.invoiceNumber}
                                            paymentType={selectedPurchase.paymentType}
                                            debtBalance={selectedPurchase.debt?.balance ?? 0}
                                            cashSessionId={activeCashSession?.id}
                                            accessToken={accessToken ?? ""}
                                            onCreditApplied={refreshSelectedPurchase}
                                        />
                                    </section>
                                </>
                            )}
                        </div>

                        <footer className={layout.footer}>
                            <p className={layout.footerMessage}>
                                {selectedPurchase.status === "RECEIVED" && !loadingDetail && !detailError && (
                                    <span id="purchase-cancel-block-reason">
                                        {capabilities?.purchaseCancellations.enabled === true
                                            ? ""
                                            : capabilities?.purchaseCancellations.reason || capabilitiesError || (capabilitiesLoading ? "Verificando la disponibilidad de anulación…" : "La anulación no está disponible temporalmente.")}
                                    </span>
                                )}
                            </p>
                            <div className={layout.footerActions}>
                                {selectedPurchase.status === "RECEIVED" && (
                                    <button type="button" className={`${layout.footerButton} ${layout.footerButtonDanger}`} onClick={() => { setCancelPurchaseError(null); setCancelReason(""); setSupplierReceivedNothing(false); setShowCancelConfirm(true) }} disabled={capabilitiesLoading || capabilities?.purchaseCancellations.enabled !== true || cancelling} aria-describedby={capabilities?.purchaseCancellations.enabled !== true ? "purchase-cancel-block-reason" : undefined}>
                                        {cancelling ? <Loader2 size={14} className={tableStyles.spinner} /> : <Ban size={14} />} Anular compra
                                    </button>
                                )}
                                <button type="button" className={layout.footerButton} onClick={closeDetail}>Cerrar</button>
                            </div>
                        </footer>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={showCancelConfirm}
                title="Anular compra errónea"
                message="Usá esta corrección solo si el proveedor confirma que no recibió el pago. Si el pago se realizó, registrá una devolución del proveedor."
                confirmText="Confirmar anulación"
                cancelText="Volver"
                type="danger"
                loading={cancelling}
                confirmDisabled={cancelReason.trim().length < 5 || !supplierReceivedNothing}
                onConfirm={handleCancelConfirm}
                onCancel={() => { setShowCancelConfirm(false); setCancelPurchaseError(null) }}
            >
                <label className={controls.label}>
                    Motivo (mínimo 5 caracteres)
                    <textarea className={controls.control} rows={3} maxLength={500} value={cancelReason} onChange={event => setCancelReason(event.target.value)} autoFocus />
                </label>
                <label className={styles.cancelSupplierConfirm}>
                    <input type="checkbox" checked={supplierReceivedNothing} onChange={event => setSupplierReceivedNothing(event.target.checked)} />
                    Confirmo que el proveedor no recibió el pago.
                </label>
                {cancelPurchaseError && <p className={styles.cancelPurchaseError} role="alert">{cancelPurchaseError}</p>}
            </ConfirmDialog>

        </div>
    )
}
