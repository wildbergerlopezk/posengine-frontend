"use client"

import type React from "react"
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react"
import { Header } from "@/src/shared/components/Header"
import { usePathname, useRouter } from "next/navigation"
import {
    Search, Plus, Trash2, Package, AlertCircle,
    Loader2, Check, X, ChevronDown,
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { useCashSession } from "@/src/features/cash-session/hooks/useCashSession"
import { API_BASE_URL } from "@/src/shared/config/api"
import styles from "./PurchasePage.module.css"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
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
import { SearchIcon } from "lucide-react"
import { usePriceHistory } from "@/src/shared/hooks/usePriceHistory"
import { PriceHistoryModal } from "@/src/shared/components/PriceHistoryModal"
import { PurchaseItemPriceModal, type PriceModalData } from "../components/PurchaseItemPriceModal"

const API_BASE = API_BASE_URL
const PURCHASE_STORAGE_KEY = "posengine_purchase_draft"

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
    cost?: number
    price: number
    wholesalePrice: number
    stock: number
    unitType: "UNIT" | "KG" | "G" | "L" | "ML" | "MG"
}

interface PurchaseItem {
    product: Product
    quantity: number
    unitCost: number
    subtotal: number
    total: number
    marginPercentage: number
    salePrice: number
    wholesaleMarginPercentage: number
    wholesalePrice: number
}

function readApiError(body: unknown): string {
    if (!body || typeof body !== "object") return "Error en la solicitud"
    const b = body as { message?: unknown; error?: string }
    if (Array.isArray(b.message)) return b.message.map(String).join(" · ")
    if (typeof b.message === "string") return b.message
    if (typeof b.error === "string") return b.error
    return "Error en la solicitud"
}

function isUnitType(unitType?: string) {
    return !unitType || unitType === "UNIT"
}

function formatQuantity(qty: number, unitType?: string) {
    if (isUnitType(unitType)) return String(qty)
    return qty % 1 === 0 ? String(qty) : String(Number(qty.toFixed(3)))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PurchasePage() {
    const { accessToken } = useAuthStore()
    const router = useRouter()
    const pathname = usePathname()
    const { session, loading: sessionLoading } = useCashSession()
    const canOperate = !!session
    const purchaseDisabled = !session && !sessionLoading
    const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
    }

    // ── Header form state ──────────────────────────────────────────────────────
    const [supplierId, setSupplierId] = useState("")
    const [invoiceNumber, setInvoiceNumber] = useState("")
    const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT">("CASH")
    const [notes, setNotes] = useState("")

    // ── Items state ────────────────────────────────────────────────────────────
    const [items, setItems] = useState<PurchaseItem[]>([])
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
    const [editingField, setEditingField] = useState<"quantity" | "unitCost" | null>(null)
    const [editingValue, setEditingValue] = useState("")
    const [priceModalIndex, setPriceModalIndex] = useState<number | null>(null)

    // ── Suppliers ──────────────────────────────────────────────────────────────
    const [suppliers, setSuppliers] = useState<Supplier[]>([])

    // ── Product search modal ───────────────────────────────────────────────────
    const [showProductModal, setShowProductModal] = useState(false)
    const [productSearch, setProductSearch] = useState("")
    const [products, setProducts] = useState<Product[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [selectedProductIndex, setSelectedProductIndex] = useState(0)

    // ── Submit ─────────────────────────────────────────────────────────────────
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [submitStep, setSubmitStep] = useState<"saving" | null>(null)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [confirmModalSelectedButton, setConfirmModalSelectedButton] = useState<"accept" | "cancel">("accept")

    // ── Barcode scanner ────────────────────────────────────────────────────────
    const [barcodeBuffer, setBarcodeBuffer] = useState("")
    const [barcodeError, setBarcodeError] = useState<string | null>(null)
    const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Invoice generator ──────────────────────────────────────────────────────
    const [generatingInvoice, setGeneratingInvoice] = useState(false)

    const priceHistory = usePriceHistory()

    // ── Refs ───────────────────────────────────────────────────────────────────
    const supplierWrapperRef = useRef<HTMLDivElement>(null)
    const invoiceRef = useRef<HTMLInputElement>(null)
    const dateRef = useRef<HTMLInputElement>(null)
    const notesRef = useRef<HTMLInputElement>(null)
    const paymentCashRef = useRef<HTMLButtonElement>(null)
    const paymentCreditRef = useRef<HTMLButtonElement>(null)
    const confirmAcceptRef = useRef<HTMLButtonElement>(null)
    const confirmCancelRef = useRef<HTMLButtonElement>(null)
    const productSearchRef = useRef<HTMLInputElement>(null)
    const editingInputRef = useRef<HTMLInputElement>(null)
    const [isDraftLoaded, setIsDraftLoaded] = useState(false)

    // ── Persistence: Load draft ───────────────────────────────────────────────
    useEffect(() => {
        const saved = sessionStorage.getItem(PURCHASE_STORAGE_KEY)
        if (saved) {
            try {
                const draft = JSON.parse(saved)
                if (draft.supplierId) setSupplierId(draft.supplierId)
                if (draft.invoiceNumber) setInvoiceNumber(draft.invoiceNumber)
                if (draft.purchaseDate) setPurchaseDate(draft.purchaseDate)
                if (draft.paymentType) setPaymentType(draft.paymentType)
                if (draft.notes) setNotes(draft.notes)
                if (draft.items) setItems(draft.items)
            } catch (e) {
                console.error("Error loading purchase draft", e)
            }
        }
        setIsDraftLoaded(true)
    }, [])

    // ── Persistence: Save draft ───────────────────────────────────────────────
    useEffect(() => {
        if (!isDraftLoaded) return
        const draft = {
            supplierId,
            invoiceNumber,
            purchaseDate,
            paymentType,
            notes,
            items
        }
        sessionStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(draft))
    }, [isDraftLoaded, supplierId, invoiceNumber, purchaseDate, paymentType, notes, items])

    // ── Computed totals ────────────────────────────────────────────────────────
    const total = items.reduce((acc, i) => acc + i.total, 0)

    // ── Fetch suppliers ────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const res = await fetch(`${API_BASE}/suppliers?limit=100`, { headers: authHeaders })
                if (res.ok) {
                    const data = await res.json()
                    setSuppliers(data.items ?? data)
                }
            } catch { /* silent */ }
        }
        void fetchSuppliers()
    }, [accessToken])

    // ── Fetch products for modal ───────────────────────────────────────────────
    const fetchProducts = useCallback(async (search: string) => {
        setLoadingProducts(true)
        try {
            const params = new URLSearchParams({ limit: "30" })
            if (search.trim()) params.set("search", search.trim())
            const res = await fetch(`${API_BASE}/product?${params}`, { headers: authHeaders })
            if (res.ok) {
                const data = await res.json()
                setProducts(data.items ?? data)
                setSelectedProductIndex(0)
            }
        } catch { /* silent */ }
        finally { setLoadingProducts(false) }
    }, [accessToken])

    useEffect(() => {
        if (!showProductModal) return
        const t = setTimeout(() => fetchProducts(productSearch), 250)
        return () => clearTimeout(t)
    }, [productSearch, showProductModal, fetchProducts])

    useEffect(() => {
        if (showProductModal) {
            setTimeout(() => productSearchRef.current?.focus(), 80)
            fetchProducts("")
        }
    }, [showProductModal])

    // ── Generate invoice number (Alt+Q) ───────────────────────────────────────
    const generateInvoiceNumber = useCallback(async () => {
        setGeneratingInvoice(true)
        try {
            const res = await fetch(`${API_BASE}/purchases/generate-invoice-number`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
            })
            if (res.ok) {
                const data = await res.json()
                setInvoiceNumber(data.invoiceNumber)
            }
        } catch { /* silent */ }
        finally { setGeneratingInvoice(false) }
    }, [accessToken])

    // ── Inline cell editing ────────────────────────────────────────────────────
    const cancelEdit = useCallback(() => {
        setEditingRowIndex(null)
        setEditingField(null)
        setEditingValue("")
    }, [])

    const startEdit = useCallback((index: number, field: "quantity" | "unitCost", current: number) => {
        setEditingRowIndex(index)
        setEditingField(field)
        setEditingValue(String(current))
    }, [])

    useEffect(() => {
        if (editingRowIndex !== null && editingField !== null) {
            const t = setTimeout(() => {
                editingInputRef.current?.focus()
                editingInputRef.current?.select()
            }, 30)
            return () => clearTimeout(t)
        }
    }, [editingRowIndex, editingField])

    const commitEdit = useCallback(() => {
        if (editingRowIndex === null || editingField === null) return
        const val = parseFloat(editingValue)
        if (isNaN(val) || val <= 0) { cancelEdit(); return }
        setItems(prev => prev.map((item, idx) => {
            if (idx !== editingRowIndex) return item
            if (editingField === "quantity" && isUnitType(item.product.unitType) && !Number.isInteger(val)) {
                setSubmitError(`"${item.product.name}" usa unidades. La cantidad debe ser entera.`)
                return item
            }
            const quantity = editingField === "quantity" ? val : item.quantity
            const unitCost = editingField === "unitCost" ? val : item.unitCost
            return { ...item, quantity, unitCost, subtotal: quantity * unitCost, total: quantity * unitCost }
        }))
        cancelEdit()
        // Blur explícito para dejar el foco libre para el lector
        editingInputRef.current?.blur()
    }, [editingRowIndex, editingField, editingValue, cancelEdit])

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index))
        cancelEdit()
    }

    // ── Submit ─────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!canOperate) { setSubmitError("Abre caja antes de registrar compras"); return }
        if (!supplierId) { setSubmitError("Seleccioná un proveedor"); return }
        if (!invoiceNumber) { setSubmitError("El número de factura es requerido"); invoiceRef.current?.focus(); return }
        if (items.length === 0) { setSubmitError("Agregá al menos un producto"); return }

        setSubmitting(true)
        setSubmitError(null)

        try {
            // ── 1. Guardar compra (Cabecera + Items) ──────────────────────────────
            setSubmitStep("saving")

            // Combinar la fecha seleccionada con la hora actual para evitar desfases de zona horaria
            // y reflejar la hora real de la transacción si es hoy.
            const now = new Date()
            const [year, month, day] = purchaseDate.split("-").map(Number)
            const dateToSave = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds())

            const purchasePayload = {
                supplierId,
                invoiceNumber,
                purchaseDate: dateToSave.toISOString(),
                paymentType,
                total,
                notes: notes.trim() || undefined,
                items: items.map(i => ({
                    productId: i.product.id,
                    quantity: i.quantity,
                    unitCost: i.unitCost,
                })),
            }

            const purchaseRes = await fetch(`${API_BASE}/purchases`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify(purchasePayload),
            })

            if (!purchaseRes.ok) {
                const body = await purchaseRes.json().catch(() => ({}))
                throw new Error(readApiError(body))
            }

            // ── 2. Actualizar precios de productos ────────────────────────────────
            // Solo si el costo o el precio de venta son diferentes al actual
            const productsToUpdate = items.filter(i =>
                i.unitCost !== i.product.cost || i.salePrice !== i.product.price
            )

            if (productsToUpdate.length > 0) {
                await Promise.all(productsToUpdate.map(async (item) => {
                    try {
                        await fetch(`${API_BASE}/product/${item.product.id}`, {
                            method: "PATCH",
                            headers: authHeaders,
                            body: JSON.stringify({
                                cost: item.unitCost,
                                price: item.salePrice,
                                wholesalePrice: item.wholesalePrice
                            })
                        })
                    } catch { }
                }))
            }

            setSuccess(true)
            setSubmitStep(null)
            sessionStorage.removeItem(PURCHASE_STORAGE_KEY)
            setTimeout(() => {
                setItems([])
                setSupplierId("")
                setInvoiceNumber("")
                setNotes("")
                setPaymentType("CASH")
                setPurchaseDate(new Date().toISOString().slice(0, 10))
                setSuccess(false)
            }, 1200)

        } catch (err: unknown) {
            setSubmitError(err instanceof Error ? err.message : "Error al guardar la compra")
            setSubmitStep(null)
        } finally {
            setSubmitting(false)
        }
    }

    const handleBarcodeAdd = useCallback(async (code: string) => {
        try {
            const res = await fetch(
                `${API_BASE}/product/barcode/${encodeURIComponent(code)}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            )

            if (!res.ok) {
                setBarcodeError(`No se encontró ningún producto con el código "${code}"`)
                return
            }

            const product: Product = await res.json()

            setItems(prev => {
                const existing = prev.findIndex(i => i.product.id === product.id)
                if (existing >= 0) {
                    const newQty = prev[existing].quantity + 1
                    setTimeout(() => startEdit(existing, "quantity", newQty), 50)
                    return prev.map((item, idx) =>
                        idx === existing
                            ? { ...item, quantity: newQty, subtotal: newQty * item.unitCost, total: newQty * item.unitCost }
                            : item
                    )
                }

                const unitCost = product.cost ?? 0
                const salePrice = product.price
                const wholesalePrice = product.wholesalePrice
                const marginPercentage = unitCost > 0 ? Number(Number(((salePrice / unitCost) - 1) * 100).toFixed(2)) : 0
                const wholesaleMarginPercentage = unitCost > 0 ? Number(Number(((wholesalePrice / unitCost) - 1) * 100).toFixed(2)) : 0
                const newIndex = prev.length

                // Abrir el modal de precios directamente
                setTimeout(() => setPriceModalIndex(newIndex), 100)

                return [...prev, {
                    product,
                    quantity: 1,
                    unitCost,
                    subtotal: unitCost,
                    total: unitCost,
                    marginPercentage,
                    salePrice,
                    wholesaleMarginPercentage,
                    wholesalePrice
                }]
            })
        } catch {
            setBarcodeError(`Error al buscar el producto con código "${code}"`)
        }
    }, [accessToken, startEdit])

    // ── Global keyboard shortcuts ──────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // ── Barcode scanner ───────────────────────────────────────────────────
            // Los lectores envían los caracteres muy rápido y terminan con Enter.
            // Si el modal está abierto o se está editando una celda, ignorar.
            const activeTag = document.activeElement?.tagName
            const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA"

            if (!showProductModal && !showConfirmModal && !isTyping) {
                if (e.key === "Enter" && barcodeBuffer.trim()) {
                    e.preventDefault()
                    const code = barcodeBuffer.trim()
                    setBarcodeBuffer("")
                    if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current)
                    void handleBarcodeAdd(code)
                    return
                }

                // Acumular caracteres del lector (ignora teclas especiales)
                if (e.key.length === 1) {
                    if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current)
                    setBarcodeBuffer(prev => prev + e.key)
                    // Si en 100ms no llega más input, limpiar buffer (tipeo manual, no lector)
                    barcodeTimerRef.current = setTimeout(() => setBarcodeBuffer(""), 100)
                    return
                }
            }

            // ── Closing modals ────────────────────────────────────────────────────
            if (e.key === "Escape") {
                if (barcodeError) {
                    setBarcodeError(null)
                    return
                }
                // If the price modal is open, let it handle Escape
                if (priceModalIndex !== null) return;
                if (showProductModal) {
                    if (priceHistory.open) return;
                    setShowProductModal(false)
                    setProductSearch("")
                    return
                }
            }

            // ── Shortcuts existentes ──────────────────────────────────────────────
            if (e.key === "F2" && !showProductModal) {
                e.preventDefault()
                setShowProductModal(true)
            }
            if (e.key === "F12" && !showProductModal && items.length > 0 && !showConfirmModal) {
                e.preventDefault()
                setShowConfirmModal(true)
                setConfirmModalSelectedButton("accept")
            }
            if (e.altKey && e.key.toLowerCase() === "q") {
                e.preventDefault()
                void generateInvoiceNumber()
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [showProductModal, showConfirmModal, barcodeBuffer, barcodeError, items, generateInvoiceNumber, handleBarcodeAdd, priceHistory.open])

    // Focus inicial al montar y al navegar a esta ruta
    useEffect(() => {
        let raf1: number
        let raf2: number
        raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => {
                const btn = supplierWrapperRef.current?.querySelector("button") as HTMLButtonElement | null
                btn?.focus()
            })
        })
        return () => {
            cancelAnimationFrame(raf1)
            cancelAnimationFrame(raf2)
        }
    }, [pathname])

    // Manejar navegación en modal de confirmación
    useEffect(() => {
        if (!showConfirmModal) return

        const handleConfirmModalKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault()
                setConfirmModalSelectedButton(prev => prev === "accept" ? "cancel" : "accept")
            }
            if (e.key === "Enter") {
                e.preventDefault()
                if (confirmModalSelectedButton === "accept") {
                    setShowConfirmModal(false)
                    handleSubmit()
                } else {
                    setShowConfirmModal(false)
                    supplierWrapperRef.current?.querySelector("button")?.focus()
                }
            }
            if (e.key === "Escape") {
                e.preventDefault()
                setShowConfirmModal(false)
                supplierWrapperRef.current?.querySelector("button")?.focus()
            }
        }

        window.addEventListener("keydown", handleConfirmModalKeyDown)
        return () => window.removeEventListener("keydown", handleConfirmModalKeyDown)
    }, [showConfirmModal, confirmModalSelectedButton])

    // Enfocar botón correcto en modal de confirmación
    useEffect(() => {
        if (showConfirmModal) {
            setTimeout(() => {
                if (confirmModalSelectedButton === "accept") {
                    confirmAcceptRef.current?.focus()
                } else {
                    confirmCancelRef.current?.focus()
                }
            }, 100)
        }
    }, [showConfirmModal, confirmModalSelectedButton])

    // ── Product modal keyboard nav ─────────────────────────────────────────────
    const handleProductModalKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setSelectedProductIndex(p => Math.min(products.length - 1, p + 1)) }
        if (e.key === "ArrowUp") { e.preventDefault(); setSelectedProductIndex(p => Math.max(0, p - 1)) }
        if (e.key === "Enter") { e.preventDefault(); const p = products[selectedProductIndex]; if (p) addProduct(p) }
        if (e.key === "F8") {
            e.preventDefault()
            const p = products[selectedProductIndex]
            if (p) priceHistory.openFor(p.id, p.name)
        }
        if (e.key === "Escape") {
            if (priceHistory.open) {
                priceHistory.close()
                return
            }
            setShowProductModal(false)
            setProductSearch("")
        }
    }

    // ── Add product to items ───────────────────────────────────────────────────
    const addProduct = (product: Product) => {
        setShowProductModal(false)
        setProductSearch("")

        setItems(prev => {
            const existing = prev.findIndex(i => i.product.id === product.id)
            if (existing >= 0) {
                const updated = prev.map((item, idx) =>
                    idx === existing
                        ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitCost, total: (item.quantity + 1) * item.unitCost }
                        : item
                )
                // Foco en la cantidad del producto existente
                setTimeout(() => startEdit(existing, "quantity", prev[existing].quantity + 1), 50)
                return updated
            }

            const unitCost = product.cost ?? 0
            const salePrice = product.price
            const wholesalePrice = product.wholesalePrice
            const marginPercentage = unitCost > 0 ? Number(Number(((salePrice / unitCost) - 1) * 100).toFixed(2)) : 0
            const wholesaleMarginPercentage = unitCost > 0 ? Number(Number(((wholesalePrice / unitCost) - 1) * 100).toFixed(2)) : 0
            const newIndex = prev.length

            // Abrir el modal de precios directamente para el nuevo producto
            setTimeout(() => setPriceModalIndex(newIndex), 100)

            return [...prev, {
                product,
                quantity: 1,
                unitCost,
                subtotal: unitCost,
                total: unitCost,
                marginPercentage,
                salePrice,
                wholesaleMarginPercentage,
                wholesalePrice
            }]
        })
    }

    // ─────────────────────────────────────────────────────────────────────────────

    return (
        <div className={styles.page}>
            <Header title="Nueva compra" />

            <div className={styles.container}>

                {purchaseDisabled && (
                    <div className={styles.blockNotice}>
                        <div>
                            <AlertCircle size={32} className={styles.noticeIcon} />
                            <h2>No hay caja abierta</h2>
                            <p>Abre caja en el módulo de Caja antes de registrar compras para mantener el control del efectivo.</p>
                            <button className={styles.openCashLink} onClick={() => router.push('/dashboard/cash')}>
                                Abrir caja
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Error banner ── */}
                {submitError && (
                    <div className={tableStyles.errorBanner}>
                        <AlertCircle size={16} />
                        {submitError}
                        <button type="button" className={styles.bannerClose} onClick={() => setSubmitError(null)}><X size={14} /></button>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════
            HEADER CARD — datos de la compra
        ══════════════════════════════════════════════════ */}
                <div className={`${styles.headerCard} ${purchaseDisabled ? styles.disabledArea : ''}`}>
                    <div className={styles.headerCardTitle}>Datos de la compra</div>

                    <div className={styles.headerGrid}>

                        {/* Proveedor */}
                        <div className={tableStyles.formGroup}>
                            <label className={tableStyles.label}>Proveedor *</label>
                            {/* Wrapper que intercepta Tab/Enter cuando el popup está CERRADO */}
                            <div
                                ref={supplierWrapperRef}
                                onKeyDown={(e) => {
                                    // Solo cuando el popup está cerrado (si está abierto, el Combobox lo maneja)
                                    if (supplierId && (e.key === "Tab" || e.key === "Enter")) {
                                        // Si Enter y popup cerrado → avanzar al siguiente campo
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            invoiceRef.current?.focus()
                                        }
                                        // Tab: dejar comportamiento nativo pero redirigir
                                        if (e.key === "Tab" && !e.shiftKey) {
                                            e.preventDefault()
                                            invoiceRef.current?.focus()
                                        }
                                    }
                                }}
                            >
                                <Combobox
                                    items={suppliers.map(s => ({
                                        label: s.name + (s.RUC ? ` · ${s.RUC}` : ""),
                                        value: s.id,
                                    }))}
                                    value={supplierId ? { value: supplierId, label: suppliers.find(s => s.id === supplierId)?.name ?? "" } : null}
                                    onValueChange={(item) => setSupplierId(item?.value ?? "")}
                                >
                                    <ComboboxTrigger>
                                        <ComboboxValue placeholder="Seleccionar proveedor…" />
                                    </ComboboxTrigger>
                                    <ComboboxPopup aria-label="Seleccionar proveedor">
                                        <div className="border-b p-2">
                                            <ComboboxInput
                                                placeholder="Buscar proveedor…"
                                                startAddon={<SearchIcon />}
                                            />
                                        </div>
                                        <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
                                        <ComboboxList>
                                            {(item) => (
                                                <ComboboxItem key={item.value} value={item}>
                                                    {item.label}
                                                </ComboboxItem>
                                            )}
                                        </ComboboxList>
                                    </ComboboxPopup>
                                </Combobox>
                            </div>
                        </div>

                        {/* Nro. Factura */}
                        <div className={tableStyles.formGroup}>
                            <label className={tableStyles.label} htmlFor="invoice">
                                Nro. Factura *
                                <span className={styles.labelHint}>Alt+Q para generar</span>
                            </label>
                            <div className={styles.invoiceWrapper}>
                                <input
                                    ref={invoiceRef}
                                    id="invoice"
                                    className={tableStyles.input}
                                    value={invoiceNumber}
                                    onChange={e => setInvoiceNumber(e.target.value)}
                                    placeholder="001-001-0000001"
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            dateRef.current?.focus()
                                        }
                                        if (e.altKey && e.key.toLowerCase() === "q") {
                                            e.preventDefault()
                                            void generateInvoiceNumber()
                                        }
                                    }}
                                    pattern="^\d{3}-\d{3}-\d{7}$"
                                    required
                                />
                                {generatingInvoice && <Loader2 size={14} className={styles.invoiceSpinner} />}
                            </div>
                            <span className={tableStyles.fieldHint}>Formato: 001-001-0000001</span>
                        </div>

                        {/* Fecha */}
                        <div className={tableStyles.formGroup}>
                            <label className={tableStyles.label} htmlFor="date">Fecha *</label>
                            <input
                                ref={dateRef}
                                id="date"
                                type="date"
                                className={tableStyles.input}
                                value={purchaseDate}
                                onChange={e => setPurchaseDate(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        // Foco en el primer botón del paymentToggle
                                        paymentCashRef.current?.focus()
                                    }
                                }}
                                required
                            />
                        </div>

                        {/* Tipo de pago */}
                        <div className={tableStyles.formGroup}>
                            <label className={tableStyles.label}>Tipo de pago</label>
                            <div className={styles.paymentToggle}>
                                <button
                                    ref={paymentCashRef}
                                    type="button"
                                    className={`${styles.payToggleBtn} ${paymentType === "CASH" ? styles.payToggleBtnActive : ""}`}
                                    onClick={() => setPaymentType("CASH")}
                                    onKeyDown={e => {
                                        if (e.key === "ArrowRight") { e.preventDefault(); setPaymentType("CREDIT"); paymentCreditRef.current?.focus() }
                                        if (e.key === "Enter") { e.preventDefault(); setPaymentType("CASH"); notesRef.current?.focus() }
                                        if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); notesRef.current?.focus() }
                                    }}
                                >
                                    Contado
                                </button>
                                <button
                                    ref={paymentCreditRef}
                                    type="button"
                                    className={`${styles.payToggleBtn} ${paymentType === "CREDIT" ? styles.payToggleBtnActive : ""}`}
                                    onClick={() => setPaymentType("CREDIT")}
                                    onKeyDown={e => {
                                        if (e.key === "ArrowLeft") { e.preventDefault(); setPaymentType("CASH"); paymentCashRef.current?.focus() }
                                        if (e.key === "Enter") { e.preventDefault(); setPaymentType("CREDIT"); notesRef.current?.focus() }
                                        if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); notesRef.current?.focus() }
                                    }}
                                >
                                    Crédito
                                </button>
                            </div>
                        </div>

                        {/* Observación — full width */}
                        <div className={`${tableStyles.formGroup} ${styles.fullWidth}`}>
                            <label className={tableStyles.label} htmlFor="notes">Observación</label>
                            <input
                                ref={notesRef}
                                id="notes"
                                className={tableStyles.input}
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Ej. Compra mensual de repuestos"
                                maxLength={500}
                                onKeyDown={e => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        // Enter desde observación → abrir modal de productos (equivale a F2)
                                        setShowProductModal(true)
                                    }
                                }}
                            />
                        </div>

                    </div>
                </div>

                {/* ══════════════════════════════════════════════════
            ITEMS — tabla de productos
        ══════════════════════════════════════════════════ */}
                <div className={`${tableStyles.tableCard} ${purchaseDisabled ? styles.disabledArea : ''}`}>

                    {/* Toolbar de items */}
                    <div className={styles.itemsToolbar}>
                        <span className={styles.itemsTitle}>
                            Productos <span className={styles.itemsCount}>{items.length}</span>
                        </span>
                        <div className={styles.itemsActions}>
                            <span className={styles.shortcutHint}><kbd>F2</kbd> Agregar</span>
                            <span className={styles.shortcutHint}><kbd>F12</kbd> Finalizar</span>
                            <button
                                type="button"
                                className={tableStyles.newButton}
                                onClick={() => setShowProductModal(true)}
                            ><Plus size={15} /> Agregar producto
                            </button>
                        </div>
                    </div>

                    <table className={tableStyles.table}>
                        <thead className={tableStyles.tableHeader}>
                            <tr>
                                <th className={tableStyles.tableHeaderCell} style={{ width: 40 }}>#</th>
                                <th className={tableStyles.tableHeaderCell} style={{ width: 130 }}>Código</th>
                                <th className={tableStyles.tableHeaderCell}>Descripción</th>
                                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 110 }}>Cant.</th>
                                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 130 }}>Costo unit.</th>
                                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 90 }}>% Púb.</th>
                                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 120 }}>P. Público</th>
                                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 90 }}>% May.</th>
                                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 120 }}>P. Mayorista</th>
                                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 130 }}>SubTotal</th>
                                <th className={tableStyles.tableHeaderCell} style={{ width: 44 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                <td colSpan={10}>
                                        <div className={tableStyles.emptyState}>
                                            <Package size={36} className={tableStyles.emptyStateIcon} />
                                            <p className={tableStyles.emptyStateTitle}>Sin productos</p>
                                            <p>Presioná <kbd className={styles.kbdInline}>F2</kbd> o el botón para agregar</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                items.map((item, idx) => (
                                    <tr key={item.product.id} className={tableStyles.tableRow}>

                                        {/* # */}
                                        <td className={tableStyles.tableCell}>
                                            <span className={styles.rowNum}>{idx + 1}</span>
                                        </td>

                                        {/* Código */}
                                        <td className={tableStyles.tableCell}>
                                            <span className={styles.codeChip}>{item.product.barcode || item.product.sku || "—"}</span>
                                        </td>

                                        {/* Descripción */}
                                        <td className={tableStyles.tableCell}>
                                            <span style={{ fontWeight: 500 }}>{item.product.name}</span>
                                            {!isUnitType(item.product.unitType) && (
                                                <span className={styles.unitBadge}>{item.product.unitType}</span>
                                            )}
                                        </td>

                                        {/* Cantidad — editable inline */}
                                        <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                                            {editingRowIndex === idx && editingField === "quantity" ? (
                                                <input
                                                    ref={editingInputRef}
                                                    className={styles.inlineInput}
                                                    type="number"
                                                    value={editingValue}
                                                    onChange={e => setEditingValue(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === "Enter" || e.key === "Tab") {
                                                            e.preventDefault()
                                                            commitEdit()
                                                            setPriceModalIndex(idx)
                                                        }
                                                        if (e.key === "Escape") cancelEdit()
                                                    }}
                                                    onBlur={commitEdit}
                                                    min={isUnitType(item.product.unitType) ? "1" : "0.001"}
                                                    step={isUnitType(item.product.unitType) ? "1" : "0.001"}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={styles.editableCell}
                                                    onClick={() => startEdit(idx, "quantity", item.quantity)}
                                                    title="Clic para editar"
                                                >
                                                    {formatQuantity(item.quantity, item.product.unitType)}
                                                </button>
                                            )}
                                        </td>

                                        {/* Costo unitario — abre modal al hacer clic */}
                                        <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                                            <button
                                                type="button"
                                                className={styles.editableCell}
                                                onClick={() => setPriceModalIndex(idx)}
                                                title="Clic para ajustar precios"
                                            >
                                                {formatCurrency(item.unitCost)}
                                            </button>
                                        </td>

                                        {/* % Gan. Público */}
                                        <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                                            <button
                                                type="button"
                                                className={styles.editableCell}
                                                onClick={() => setPriceModalIndex(idx)}
                                                title="Clic para ajustar precios"
                                            >
                                                {item.marginPercentage.toFixed(1)}%
                                            </button>
                                        </td>

                                        {/* Precio Público */}
                                        <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                                            <button
                                                type="button"
                                                className={styles.editableCell}
                                                onClick={() => setPriceModalIndex(idx)}
                                                title="Clic para ajustar precios"
                                            >
                                                {formatCurrency(item.salePrice)}
                                            </button>
                                        </td>

                                        {/* % Gan. Mayorista */}
                                        <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                                            <button
                                                type="button"
                                                className={styles.editableCell}
                                                onClick={() => setPriceModalIndex(idx)}
                                                title="Clic para ajustar precios"
                                            >
                                                {(item.wholesaleMarginPercentage ?? 0).toFixed(1)}%
                                            </button>
                                        </td>

                                        {/* Precio Mayorista */}
                                        <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                                            <button
                                                type="button"
                                                className={styles.editableCell}
                                                onClick={() => setPriceModalIndex(idx)}
                                                title="Clic para ajustar precios"
                                            >
                                                {formatCurrency(item.wholesalePrice ?? 0)}
                                            </button>
                                        </td>

                                        {/* SubTotal */}
                                        <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                                            <strong>{formatCurrency(item.subtotal)}</strong>
                                        </td>

                                        {/* Eliminar */}
                                        <td className={tableStyles.tableCell}>
                                            <button
                                                type="button"
                                                className={styles.removeBtn}
                                                onClick={() => removeItem(idx)}
                                                title="Eliminar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>

                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* ── Footer totales + acciones ── */}
                    {items.length > 0 && (
                        <div className={styles.tableFooter}>
                            <div className={styles.totalsBlock}>
                                <div className={`${styles.totalRow} ${styles.totalRowFinal}`}>
                                    <span className={styles.totalLabel}>Total</span>
                                    <span className={styles.totalValueFinal}>{formatCurrency(total)}</span>
                                </div>
                            </div>

                            <div className={styles.footerActions}>
                                <button
                                    type="button"
                                    className={tableStyles.cancelButton}
                                    onClick={() => { setItems([]); cancelEdit() }}
                                    disabled={submitting}
                                >
                                    Limpiar
                                </button>
                                <button
                                    type="button"
                                    className={tableStyles.submitButton}
                                    onClick={() => {
                                        if (items.length > 0) {
                                            setShowConfirmModal(true)
                                            setConfirmModalSelectedButton("accept")
                                        }
                                    }}
                                    disabled={submitting || success}
                                >
                                    {success
                                        ? <><Check size={15} /> Guardado</>
                                        : submitting
                                            ? <><Loader2 size={15} className={tableStyles.spinner} /> Guardando compra…</>
                                            : <><Check size={15} /> Finalizar compra <kbd className={styles.kbdWhite}>F12</kbd></>
                                    }
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* ══════════════════════════════════════════════════
          MODAL — búsqueda de productos (F2)
      ══════════════════════════════════════════════════ */}
            {showProductModal && (
                <div className={tableStyles.modalOverlay} onClick={() => { setShowProductModal(false); setProductSearch("") }}>
                    <div className={styles.productModal} onClick={e => e.stopPropagation()}>

                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>Agregar producto</h2>
                            <button type="button" className={styles.modalCloseBtn} onClick={() => { setShowProductModal(false); setProductSearch("") }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search input */}
                        <div className={styles.modalSearchBox}>
                            <Search size={16} className={styles.modalSearchIcon} />
                            <input
                                ref={productSearchRef}
                                className={styles.modalSearchInput}
                                placeholder="Buscar por nombre, código o SKU…"
                                value={productSearch}
                                onChange={e => { setProductSearch(e.target.value); setSelectedProductIndex(0) }}
                                onKeyDown={handleProductModalKeyDown}
                            />
                        </div>

                        {/* Product list */}
                        <div className={styles.productList}>
                            {loadingProducts ? (
                                <div className={styles.productListEmpty}>
                                    <Loader2 size={24} className={tableStyles.spinner} />
                                </div>
                            ) : products.length === 0 ? (
                                <div className={styles.productListEmpty}>
                                    <Package size={28} style={{ opacity: 0.3 }} />
                                    <p>Sin resultados</p>
                                </div>
                            ) : (
                                products.map((product, idx) => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        className={`${styles.productRow} ${selectedProductIndex === idx ? styles.productRowSelected : ""}`}
                                        onClick={() => addProduct(product)}
                                        onMouseEnter={() => setSelectedProductIndex(idx)}
                                    >
                                        <span className={styles.productRowCode}>{product.barcode || product.sku || "—"}</span>
                                        <span className={styles.productRowName}>{product.name}</span>
                                        <span className={styles.productRowUnit}>{!isUnitType(product.unitType) ? product.unitType : ""}</span>
                                        <span className={styles.productRowStock}>Stock: {formatQuantity(product.stock, product.unitType)}</span>
                                        <span className={styles.productRowCost}>{product.cost != null ? formatCurrency(product.cost) : "—"}</span>
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Hints */}
                        <div className={styles.modalHints}>
                            <span><kbd>↑↓</kbd> Navegar</span>
                            <span><kbd>Enter</kbd> Seleccionar</span>
                            <span><kbd>F8</kbd> Último precio</span>
                            <span><kbd>Esc</kbd> Cerrar</span>
                        </div>

                    </div>
                </div>
            )}
            {/* Confirm Modal */}
            {showConfirmModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.confirmModal}>
                        <div className={styles.confirmIcon}>
                            <AlertCircle size={40} />
                        </div>
                        <h2 className={styles.confirmTitle}>¿Finalizar compra?</h2>
                        <p className={styles.confirmDescription}>
                            Total: <strong>{formatCurrency(total)}</strong>
                        </p>
                        <div className={styles.confirmButtons}>
                            <button
                                ref={confirmCancelRef}
                                className={`${styles.confirmCancel} ${confirmModalSelectedButton === "cancel" ? styles.buttonFocused : ""}`}
                                onClick={() => {
                                    setShowConfirmModal(false)
                                    supplierWrapperRef.current?.querySelector("button")?.focus()
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                ref={confirmAcceptRef}
                                className={`${styles.confirmAccept} ${confirmModalSelectedButton === "accept" ? styles.buttonFocused : ""}`}
                                onClick={() => {
                                    setShowConfirmModal(false)
                                    handleSubmit()
                                }}
                            >
                                Aceptar
                            </button>
                        </div>
                        <div className={styles.confirmHint}>
                            <kbd>←→</kbd> Navegar <kbd>Enter</kbd> Confirmar <kbd>Esc</kbd> Cancelar
                        </div>
                    </div>
                </div>
            )}
            {barcodeError && (
                <div className={styles.modalOverlay} onClick={() => setBarcodeError(null)}>
                    <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.confirmIcon} style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                            <AlertCircle size={40} />
                        </div>
                        <h2 className={styles.confirmTitle}>Producto no encontrado</h2>
                        <p className={styles.confirmDescription}>{barcodeError}</p>
                        <div className={styles.confirmButtons}>
                            <button
                                className={styles.confirmAccept}
                                onClick={() => setBarcodeError(null)}
                                autoFocus
                            >
                                Aceptar
                            </button>
                        </div>
                        <div className={styles.confirmHint}>
                            <kbd>Enter</kbd> o <kbd>Esc</kbd> para cerrar
                        </div>
                    </div>
                </div>
            )}
            <PriceHistoryModal
                open={priceHistory.open}
                loading={priceHistory.loading}
                history={priceHistory.history}
                productName={priceHistory.productName}
                page={priceHistory.page}
                totalItems={priceHistory.totalItems}
                limit={priceHistory.limit}
                onPageChange={priceHistory.goToPage}
                onClose={priceHistory.close}
            />

            {priceModalIndex !== null && (
                <PurchaseItemPriceModal
                    product={items[priceModalIndex].product}
                    initialData={{
                        quantity: items[priceModalIndex].quantity,
                        unitCost: items[priceModalIndex].unitCost,
                        marginPercentage: items[priceModalIndex].marginPercentage,
                        salePrice: items[priceModalIndex].salePrice,
                        wholesaleMarginPercentage: items[priceModalIndex].wholesaleMarginPercentage,
                        wholesalePrice: items[priceModalIndex].wholesalePrice
                    }}
                    onClose={() => setPriceModalIndex(null)}
                    onSave={(data) => {
                        setItems(prev => prev.map((it, i) => {
                            if (i !== priceModalIndex) return it
                            return {
                                ...it,
                                quantity: data.quantity,
                                unitCost: data.unitCost,
                                marginPercentage: data.marginPercentage,
                                salePrice: data.salePrice,
                                wholesaleMarginPercentage: data.wholesaleMarginPercentage,
                                wholesalePrice: data.wholesalePrice,
                                subtotal: data.quantity * data.unitCost,
                                total: data.quantity * data.unitCost
                            }
                        }))
                        setPriceModalIndex(null)
                    }}
                />
            )}
        </div>
    )
}
