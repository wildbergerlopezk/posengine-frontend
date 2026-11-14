"use client"

import type React from "react"
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react"
import { useHydrated } from "@/src/shared/hooks/useHydrated"
import { Header } from "@/src/shared/components/Header"
import { ProductSearchModal } from "@/src/shared/components/ProductSearchModal"
import { usePathname, useRouter } from "next/navigation"
import {
    Search, Plus, Trash2, Package, AlertCircle,
    Loader2, Check, X, ChevronDown, ChevronUp,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import transactionTableStyles from "@/src/shared/components/TransactionItemsTable/TransactionItemsTable.module.css"
import dataTableStyles from "@/src/shared/components/DataTable/DataTable.module.css"
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
import { ZeroCostWarningModal } from "../components/ZeroCostWarningModal"

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
    const [purchaseDetailsCollapsed, setPurchaseDetailsCollapsed] = useState(false)
    const [zeroCostProducts, setZeroCostProducts] = useState<string[]>([])

    // ── Debt state ──────────────────────────────────────────────────────────────
    const [debtScheduleType, setDebtScheduleType] = useState<"NONE" | "OWNER_REMINDER" | "SUPPLIER_SCHEDULE">("NONE")
    const [debtDueDate, setDebtDueDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [showDebtModal, setShowDebtModal] = useState(false)
    const [debtInstallments, setDebtInstallments] = useState<{ number: number; amount: number; dueDate: string }[]>([
        { number: 1, amount: 0, dueDate: new Date().toISOString().slice(0, 10) }
    ])

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
    const debtScheduleTypeRef = useRef<HTMLSelectElement>(null)
    const debtDueDateRef = useRef<HTMLInputElement>(null)
    const debtConfigureRef = useRef<HTMLButtonElement>(null)
    const debtModalDoneRef = useRef<HTMLButtonElement>(null)
    const debtModalRef = useRef<HTMLDivElement>(null)
    const wasDebtModalOpenRef = useRef(false)
    const pendingPurchaseDetailsFocusRef = useRef<"supplier" | "invoice" | "debt" | null>(null)
    const confirmAcceptRef = useRef<HTMLButtonElement>(null)
    const confirmCancelRef = useRef<HTMLButtonElement>(null)
    const editingInputRef = useRef<HTMLInputElement>(null)
    const isHydrated = useHydrated()
    const [isDraftLoaded, setIsDraftLoaded] = useState(false)

    const focusPurchaseDetailsTarget = useCallback((target: "supplier" | "invoice" | "debt") => {
        if (target === "supplier") {
            supplierWrapperRef.current?.querySelector<HTMLElement>('button, [role="combobox"], input')?.focus()
        } else if (target === "invoice") {
            invoiceRef.current?.focus()
        } else {
            debtConfigureRef.current?.focus()
        }
    }, [])

    const revealPurchaseDetailsForFocus = (target: "supplier" | "invoice" | "debt") => {
        if (purchaseDetailsCollapsed) {
            pendingPurchaseDetailsFocusRef.current = target
            setPurchaseDetailsCollapsed(false)
            return
        }
        focusPurchaseDetailsTarget(target)
    }

    useLayoutEffect(() => {
        const target = pendingPurchaseDetailsFocusRef.current
        if (purchaseDetailsCollapsed || !target) return
        pendingPurchaseDetailsFocusRef.current = null
        focusPurchaseDetailsTarget(target)
    }, [focusPurchaseDetailsTarget, purchaseDetailsCollapsed])

    // ── Persistence: Load draft ───────────────────────────────────────────────
    useEffect(() => {
        if (!isHydrated) return

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
                if (draft.debtScheduleType) setDebtScheduleType(draft.debtScheduleType)
                if (draft.debtDueDate) setDebtDueDate(draft.debtDueDate)
                if (draft.debtInstallments) setDebtInstallments(draft.debtInstallments)
            } catch (e) {
                console.error("Error loading purchase draft", e)
            }
        }
        setIsDraftLoaded(true)
    }, [isHydrated])

    // ── Persistence: Save draft ───────────────────────────────────────────────
    useEffect(() => {
        if (!isDraftLoaded) return
        const draft = {
            supplierId,
            invoiceNumber,
            purchaseDate,
            paymentType,
            notes,
            items,
            debtScheduleType,
            debtDueDate,
            debtInstallments
        }
        sessionStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(draft))
    }, [isDraftLoaded, supplierId, invoiceNumber, purchaseDate, paymentType, notes, items, debtScheduleType, debtDueDate, debtInstallments])

    // ── Computed totals ────────────────────────────────────────────────────────
    const total = items.reduce((acc, i) => acc + i.total, 0)
    const debtInstallmentsTotal = debtInstallments.reduce((acc, installment) => acc + installment.amount, 0)
    const hasValidInstallmentSequence = debtInstallments
        .map(installment => installment.number)
        .sort((a, b) => a - b)
        .every((number, index) => number === index + 1)
    const debtScheduleNeedsReview = debtScheduleType === "NONE"
        ? !debtDueDate
        : debtInstallments.length === 0
            || Math.abs(debtInstallmentsTotal - total) > 1
            || !hasValidInstallmentSequence
    const debtScheduleSummary = debtScheduleType === "NONE"
        ? `Pago único${debtDueDate ? ` · vence ${new Date(`${debtDueDate}T00:00:00`).toLocaleDateString("es-PY")}` : " · falta fecha"}`
        : `${debtScheduleType === "OWNER_REMINDER" ? "Recordatorio del dueño" : "Cuotas del proveedor"} · ${debtInstallments.length} ${debtInstallments.length === 1 ? "cuota" : "cuotas"}`

    useLayoutEffect(() => {
        if (showDebtModal) {
            debtScheduleTypeRef.current?.focus()
        } else if (wasDebtModalOpenRef.current) {
            const focusTarget = paymentType === "CREDIT" ? debtConfigureRef.current : paymentCashRef.current
            const activeElement = document.activeElement
            // Preserve an intentional focus handoff (for example, Enter from Contado to Observación).
            if (!activeElement || activeElement === document.body) focusTarget?.focus()
        }
        wasDebtModalOpenRef.current = showDebtModal
    }, [showDebtModal, paymentType])

    const trapDebtModalFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Tab" || !debtModalRef.current) return

        const focusableElements = Array.from(
            debtModalRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
        )
        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]
        const activeElement = document.activeElement

        if (event.shiftKey && (activeElement === firstElement || !debtModalRef.current.contains(activeElement))) {
            event.preventDefault()
            lastElement.focus()
        } else if (!event.shiftKey && (activeElement === lastElement || !debtModalRef.current.contains(activeElement))) {
            event.preventDefault()
            firstElement.focus()
        }
    }

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
    const fetchProducts = useCallback(async (search: string, signal: AbortSignal) => {
        setLoadingProducts(true)
        try {
            const params = new URLSearchParams({ limit: "30" })
            if (search.trim()) params.set("search", search.trim())
            const res = await fetch(`${API_BASE}/product/search?${params}`, { headers: authHeaders, signal })
            if (res.ok && !signal.aborted) {
                const data = await res.json()
                if (!signal.aborted) setProducts(data.items ?? data)
            }
        } catch { /* silent */ }
        finally {
            if (!signal.aborted) setLoadingProducts(false)
        }
    }, [accessToken])

    useEffect(() => {
        if (!showProductModal) return
        const controller = new AbortController()
        setLoadingProducts(true)

        let debounce: ReturnType<typeof setTimeout> | null = null
        const loadProducts = () => { void fetchProducts(productSearch, controller.signal) }
        if (productSearch.trim()) {
            debounce = setTimeout(loadProducts, 250)
        } else {
            loadProducts()
        }

        return () => {
            if (debounce) clearTimeout(debounce)
            controller.abort()
        }
    }, [productSearch, showProductModal, fetchProducts])

    const openProductModal = useCallback(() => {
        setLoadingProducts(true)
        setShowProductModal(true)
    }, [])

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
        if (!supplierId) {
            setSubmitError("Seleccioná un proveedor")
            revealPurchaseDetailsForFocus("supplier")
            return
        }
        if (!invoiceNumber) {
            setSubmitError("El número de factura es requerido")
            revealPurchaseDetailsForFocus("invoice")
            return
        }
        if (items.length === 0) { setSubmitError("Agregá al menos un producto"); return }

        const invalidItems = items.filter(i => i.unitCost <= 0)
        if (invalidItems.length > 0) {
            setZeroCostProducts(invalidItems.map(i => i.product.name))
            return
        }

        if (paymentType === "CREDIT") {
            if (debtScheduleType === "NONE") {
                if (!debtDueDate) {
                    setSubmitError("Debe indicar una fecha límite de pago para la compra a crédito")
                    revealPurchaseDetailsForFocus("debt")
                    return
                }
            } else {
                if (!debtInstallments.length) {
                    setSubmitError("Debe indicar al menos una cuota")
                    revealPurchaseDetailsForFocus("debt")
                    return
                }
                const sum = debtInstallments.reduce((acc, i) => acc + i.amount, 0)
                if (Math.abs(sum - total) > 1) {
                    setSubmitError(`La suma de las cuotas (${sum}) no coincide con el total de la compra (${total})`)
                    revealPurchaseDetailsForFocus("debt")
                    return
                }
                const numbers = debtInstallments.map(i => i.number).sort((a, b) => a - b)
                for (let i = 0; i < numbers.length; i++) {
                    if (numbers[i] !== i + 1) {
                        setSubmitError("Las cuotas deben estar numeradas consecutivamente desde 1")
                        revealPurchaseDetailsForFocus("debt")
                        return
                    }
                }
            }
        }

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

            const purchasePayload: any = {
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

            if (paymentType === "CREDIT") {
                if (debtScheduleType === "NONE") {
                    purchasePayload.debt = {
                        scheduleType: debtScheduleType,
                        dueDate: new Date(debtDueDate).toISOString(),
                    }
                } else {
                    purchasePayload.debt = {
                        scheduleType: debtScheduleType,
                        installments: debtInstallments.map(inst => ({
                            number: inst.number,
                            amount: inst.amount,
                            dueDate: new Date(inst.dueDate).toISOString(),
                        })),
                    }
                }
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

            const productUpdateErrors: string[] = []
            if (productsToUpdate.length > 0) {
                await Promise.all(productsToUpdate.map(async (item) => {
                    try {
                        const updateRes = await fetch(`${API_BASE}/product/${item.product.id}`, {
                            method: "PATCH",
                            headers: authHeaders,
                            body: JSON.stringify({
                                cost: item.unitCost,
                                price: item.salePrice,
                                wholesalePrice: item.wholesalePrice
                            })
                        })

                        if (!updateRes.ok) {
                            const body = await updateRes.json().catch(() => ({}))
                            productUpdateErrors.push(
                                `${item.product.name}: ${readApiError(body)}`,
                            )
                        }
                    } catch (updateErr) {
                        productUpdateErrors.push(
                            `${item.product.name}: error al actualizar el producto`,
                        )
                    }
                }))
            }

            if (productUpdateErrors.length > 0) {
                setSubmitError(
                    `Compra guardada, pero no se actualizaron algunos precios: ${productUpdateErrors.join('; ')}`,
                )
            } else {
                setSuccess(true)
            }

            setSubmitStep(null)
            sessionStorage.removeItem(PURCHASE_STORAGE_KEY)
            setTimeout(() => {
                setItems([])
                setSupplierId("")
                setInvoiceNumber("")
                setNotes("")
                setPaymentType("CASH")
                setPurchaseDetailsCollapsed(false)
                setPurchaseDate(new Date().toISOString().slice(0, 10))
                setDebtScheduleType("NONE")
                setDebtDueDate(new Date().toISOString().slice(0, 10))
                setDebtInstallments([{ number: 1, amount: 0, dueDate: new Date().toISOString().slice(0, 10) }])
                setSuccess(false)
            }, 1200)

        } catch (err: unknown) {
            setSubmitError(err instanceof Error ? err.message : "Error al guardar la compra")
            setPurchaseDetailsCollapsed(false)
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
                if (showDebtModal) {
                    e.preventDefault()
                    setShowDebtModal(false)
                    return
                }
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
            if (e.key === "F2" && !showProductModal && !showDebtModal) {
                e.preventDefault()
                openProductModal()
            }
            if (e.key === "F12" && !showProductModal && !showDebtModal && items.length > 0 && !showConfirmModal) {
                e.preventDefault()
                setShowConfirmModal(true)
                setConfirmModalSelectedButton("accept")
            }
            if (e.altKey && e.key.toLowerCase() === "q" && !showDebtModal) {
                e.preventDefault()
                void generateInvoiceNumber()
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [showProductModal, showDebtModal, showConfirmModal, barcodeBuffer, barcodeError, items, generateInvoiceNumber, handleBarcodeAdd, priceHistory.open, openProductModal])

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
                <Collapsible
                    open={!purchaseDetailsCollapsed}
                    onOpenChange={(open) => setPurchaseDetailsCollapsed(!open)}
                    className={`${styles.headerCard} ${purchaseDetailsCollapsed ? styles.headerCardCollapsed : ''} ${purchaseDisabled ? styles.disabledArea : ''}`}
                >
                    <div className={styles.headerCardHeading}>
                        <div className={styles.headerCardTitle}>Datos de la compra</div>
                        {purchaseDetailsCollapsed && (
                            <div className={styles.headerCollapsedSummary} title={[
                                suppliers.find(supplier => supplier.id === supplierId)?.name ?? (supplierId ? "Proveedor seleccionado" : "Sin proveedor"),
                                invoiceNumber || "Sin factura",
                                paymentType === "CASH" ? "Contado" : "Crédito",
                            ].join(" · ")}>
                                <span>{suppliers.find(supplier => supplier.id === supplierId)?.name ?? (supplierId ? "Proveedor seleccionado" : "Sin proveedor")}</span>
                                <span aria-hidden="true"> · </span>
                                <span>{invoiceNumber || "Sin factura"}</span>
                                <span aria-hidden="true"> · </span>
                                <span>{paymentType === "CASH" ? "Contado" : "Crédito"}</span>
                            </div>
                        )}
                        <CollapsibleTrigger asChild>
                            <button
                                type="button"
                                className={styles.headerCardToggle}
                                aria-label={purchaseDetailsCollapsed ? "Expandir datos de la compra" : "Contraer datos de la compra"}
                            >
                                {purchaseDetailsCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                            </button>
                        </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent className={styles.headerGrid}>

                        {/* Proveedor */}
                        <div className={`${tableStyles.formGroup} ${styles.headerField}`}>
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
                        <div className={`${tableStyles.formGroup} ${styles.headerField}`}>
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
                        <div className={`${tableStyles.formGroup} ${styles.headerField}`}>
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
                        <div className={`${tableStyles.formGroup} ${styles.headerField}`}>
                            <label className={tableStyles.label}>Tipo de pago</label>
                            <div className={styles.paymentToggle}>
                                <button
                                    ref={paymentCashRef}
                                    type="button"
                                    className={`${styles.payToggleBtn} ${paymentType === "CASH" ? styles.payToggleBtnActive : ""}`}
                                    onClick={() => { setPaymentType("CASH"); setShowDebtModal(false) }}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") { e.preventDefault(); setPaymentType("CASH"); setShowDebtModal(false); notesRef.current?.focus() }
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
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            setPaymentType("CREDIT")
                                            setShowDebtModal(true)
                                        }
                                    }}
                                >
                                    Crédito
                                </button>
                            </div>
                        </div>

                        <div className={`${styles.headerMetaRow} ${paymentType === "CREDIT" ? styles.headerMetaRowCredit : ""}`}>
                            {paymentType === "CREDIT" && (
                                <div className={styles.debtSummary}>
                                    <div className={styles.debtSummaryInfo}>
                                        <span className={styles.debtSummaryTitle}>Detalle de la deuda</span>
                                        <span className={styles.debtSummaryText}>{debtScheduleSummary}</span>
                                        <span className={debtScheduleNeedsReview ? styles.debtSummaryWarning : styles.debtSummaryReady}>
                                            {debtScheduleNeedsReview ? "Revisar configuración" : "Configuración lista"}
                                        </span>
                                    </div>
                                    <button
                                        ref={debtConfigureRef}
                                        type="button"
                                        className={styles.configureDebtButton}
                                        onClick={() => setShowDebtModal(true)}
                                    >
                                        Configurar cuotas
                                    </button>
                                </div>
                            )}

                            {/* Observación — comparte fila con el resumen cuando hay espacio */}
                            <div className={`${tableStyles.formGroup} ${styles.headerField} ${styles.headerNotes}`}>
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
                                            openProductModal()
                                        }
                                    }}
                                />
                            </div>
                        </div>

                    </CollapsibleContent>
                </Collapsible>

                {/* ══════════════════════════════════════════════════
            ITEMS — tabla de productos
        ══════════════════════════════════════════════════ */}
                <div className={`${tableStyles.tableCard} ${dataTableStyles.flexColumn} ${transactionTableStyles.itemsTableCard} ${purchaseDisabled ? styles.disabledArea : ''}`}>

                    {/* Toolbar de items */}
                    <div className={transactionTableStyles.itemsToolbar}>
                        <span className={transactionTableStyles.itemsTitle}>
                            Productos <span className={transactionTableStyles.itemsCount}>{items.length}</span>
                        </span>
                        <div className={transactionTableStyles.itemsActions}>
                            <span className={transactionTableStyles.shortcutHint}><kbd>F2</kbd> Agregar</span>
                            <span className={transactionTableStyles.shortcutHint}><kbd>F12</kbd> Finalizar</span>
                            <button
                                type="button"
                                className={`${tableStyles.newButton} ${styles.addProductButton}`}
                                onClick={openProductModal}
                            ><Plus size={15} /> Agregar producto
                            </button>
                        </div>
                    </div>

                    <div className={dataTableStyles.viewport}>
                        <table className={`${tableStyles.table} ${dataTableStyles.naturalRows} ${dataTableStyles.compactCells} ${transactionTableStyles.purchaseItemsTable}`}>
                            <thead className={tableStyles.tableHeader}>
                                <tr>
                                    <th className={tableStyles.tableHeaderCell} style={{ width: 36 }}>#</th>
                                    <th className={tableStyles.tableHeaderCell} style={{ width: 110 }}>Código</th>
                                    <th className={tableStyles.tableHeaderCell}>Descripción</th>
                                    <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 75 }}>Cant.</th>
                                    <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 110 }}>Costo unit.</th>
                                    <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 75 }}>% Púb.</th>
                                    <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 110 }}>P. Público</th>
                                    <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 75 }}>% May.</th>
                                    <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 115 }}>P. Mayorista</th>
                                    <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 115 }}>SubTotal</th>
                                    <th className={tableStyles.tableHeaderCell} style={{ width: 48 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr>
                                    <td colSpan={11}>
                                            <div className={`${tableStyles.emptyState} ${transactionTableStyles.itemsTableEmptyState}`}>
                                                <Package size={36} className={tableStyles.emptyStateIcon} />
                                                <p className={tableStyles.emptyStateTitle}>Sin productos</p>
                                                <p>Presioná <kbd className={transactionTableStyles.kbdInline}>F2</kbd> o el botón para agregar</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item, idx) => (
                                        <tr key={item.product.id} className={tableStyles.tableRow}>

                                            {/* # */}
                                            <td className={tableStyles.tableCell}>
                                                <span className={transactionTableStyles.rowNum}>{idx + 1}</span>
                                            </td>

                                            {/* Código */}
                                            <td className={tableStyles.tableCell}>
                                                <span className={transactionTableStyles.codeChip}>{item.product.barcode || item.product.sku || "—"}</span>
                                            </td>

                                            {/* Descripción */}
                                            <td className={tableStyles.tableCell}>
                                                <span style={{ fontWeight: 500 }}>{item.product.name}</span>
                                                {!isUnitType(item.product.unitType) && (
                                                    <span className={transactionTableStyles.unitBadge}>{item.product.unitType}</span>
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
                                                        className={transactionTableStyles.editableCell}
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
                                                    className={transactionTableStyles.editableCell}
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
                                                    className={transactionTableStyles.editableCell}
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
                                                    className={transactionTableStyles.editableCell}
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
                                                    className={transactionTableStyles.editableCell}
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
                                                    className={transactionTableStyles.editableCell}
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
                                                    className={transactionTableStyles.removeBtn}
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
                    </div>

                    {/* ── Footer totales + acciones ── */}
                    {items.length > 0 && (
                        <div className={transactionTableStyles.tableFooter}>
                            <div className={transactionTableStyles.totalsBlock}>
                                <div className={`${transactionTableStyles.totalRow} ${transactionTableStyles.totalRowFinal}`}>
                                    <span className={transactionTableStyles.totalLabel}>Total</span>
                                    <span className={transactionTableStyles.totalValueFinal}>{formatCurrency(total)}</span>
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

            {showDebtModal && paymentType === "CREDIT" && (
                <div
                    className={styles.debtModalOverlay}
                    onClick={(event) => event.target === event.currentTarget && setShowDebtModal(false)}
                >
                    <div
                        data-pos-modal
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="purchase-debt-title"
                        className={styles.debtModal}
                        ref={debtModalRef}
                        onKeyDown={trapDebtModalFocus}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className={styles.debtModalHeader}>
                            <div>
                                <h2 id="purchase-debt-title" className={styles.debtModalTitle}>Detalle de la deuda</h2>
                                <p className={styles.debtModalSubtitle}>Configurá el cronograma para el total actual de la compra.</p>
                            </div>
                            <button type="button" className={styles.modalCloseBtn} onClick={() => setShowDebtModal(false)} aria-label="Cerrar configuración de deuda">
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.debtModalBody}>
                            <div className={styles.debtFormGrid}>
                                <div className={tableStyles.formGroup}>
                                    <label className={tableStyles.label} htmlFor="debt-schedule-type">Tipo de cronograma</label>
                                    <select
                                        id="debt-schedule-type"
                                        ref={debtScheduleTypeRef}
                                        className={tableStyles.input}
                                        value={debtScheduleType}
                                        onChange={e => {
                                            const value = e.target.value as typeof debtScheduleType
                                            setDebtScheduleType(value)
                                            if (value !== "NONE" && debtInstallments.length === 0) {
                                                setDebtInstallments([{ number: 1, amount: total, dueDate: new Date().toISOString().slice(0, 10) }])
                                            }
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") {
                                                e.preventDefault()
                                                if (debtScheduleType === "NONE") debtDueDateRef.current?.focus()
                                                else window.setTimeout(() => document.getElementById("inst-amount-0")?.focus(), 50)
                                            }
                                        }}
                                    >
                                        <option value="NONE">Pago único (sin cuotas)</option>
                                        <option value="OWNER_REMINDER">Recordatorio de cuotas (dueño)</option>
                                        <option value="SUPPLIER_SCHEDULE">Cuotas impuestas por proveedor</option>
                                    </select>
                                </div>

                                {debtScheduleType === "NONE" ? (
                                    <div className={tableStyles.formGroup}>
                                        <label className={tableStyles.label} htmlFor="debt-due-date">Fecha límite de pago</label>
                                        <input
                                            id="debt-due-date"
                                            ref={debtDueDateRef}
                                            type="date"
                                            className={tableStyles.input}
                                            value={debtDueDate}
                                            onChange={e => setDebtDueDate(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault()
                                                    debtModalDoneRef.current?.focus()
                                                }
                                            }}
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div className={`${styles.installmentsWrapper} ${styles.fullWidth}`}>
                                        <div className={styles.installmentsHeader}>
                                            <span className={styles.installmentsTitle}>Cuotas ({debtInstallments.length})</span>
                                            <button
                                                type="button"
                                                className={styles.addInstallmentBtn}
                                                onClick={() => {
                                                    const nextNumber = debtInstallments.length + 1
                                                    const remaining = Math.max(0, total - debtInstallmentsTotal)
                                                    setDebtInstallments([
                                                        ...debtInstallments,
                                                        { number: nextNumber, amount: remaining, dueDate: new Date().toISOString().slice(0, 10) },
                                                    ])
                                                    window.setTimeout(() => document.getElementById(`inst-amount-${nextNumber - 1}`)?.focus(), 50)
                                                }}
                                            >
                                                + Agregar cuota
                                            </button>
                                        </div>

                                        <div className={styles.installmentsList}>
                                            {debtInstallments.map((installment, index) => (
                                                <div key={index} className={styles.installmentRow}>
                                                    <span className={styles.instNumber}>Cuota {installment.number}</span>
                                                    <div className={tableStyles.formGroup}>
                                                        <label className={styles.visuallyHidden} htmlFor={`inst-amount-${index}`}>Importe de cuota {installment.number}</label>
                                                        <input
                                                            id={`inst-amount-${index}`}
                                                            type="text"
                                                            inputMode="numeric"
                                                            placeholder="Monto"
                                                            className={tableStyles.input}
                                                            value={installment.amount ? new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0 }).format(installment.amount) : ""}
                                                            onChange={e => {
                                                                const clean = e.target.value.replace(/\D/g, "")
                                                                const value = clean ? parseInt(clean, 10) : 0
                                                                setDebtInstallments(debtInstallments.map((item, itemIndex) =>
                                                                    itemIndex === index ? { ...item, amount: value } : item
                                                                ))
                                                            }}
                                                            onKeyDown={e => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault()
                                                                    document.getElementById(`inst-date-${index}`)?.focus()
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <div className={tableStyles.formGroup}>
                                                        <label className={styles.visuallyHidden} htmlFor={`inst-date-${index}`}>Vencimiento de cuota {installment.number}</label>
                                                        <input
                                                            id={`inst-date-${index}`}
                                                            type="date"
                                                            className={tableStyles.input}
                                                            value={installment.dueDate}
                                                            onChange={e => setDebtInstallments(debtInstallments.map((item, itemIndex) =>
                                                                itemIndex === index ? { ...item, dueDate: e.target.value } : item
                                                            ))}
                                                            onKeyDown={e => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault()
                                                                    const nextAmount = document.getElementById(`inst-amount-${index + 1}`)
                                                                    if (nextAmount) nextAmount.focus()
                                                                    else debtModalDoneRef.current?.focus()
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className={styles.deleteInstallmentBtn}
                                                        aria-label={`Eliminar cuota ${installment.number}`}
                                                        onClick={() => {
                                                            const remainingInstallments = debtInstallments.filter((_, itemIndex) => itemIndex !== index)
                                                            setDebtInstallments(remainingInstallments.map((item, itemIndex) => ({ ...item, number: itemIndex + 1 })))
                                                        }}
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className={styles.installmentsSummary}>
                                            <span className={debtScheduleNeedsReview ? styles.summaryAlert : styles.summaryOk}>
                                                Suma: {formatCurrency(debtInstallmentsTotal)} / Total: {formatCurrency(total)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.debtModalFooter}>
                            <div className={styles.debtModalTotals}>
                                <span>Total de compra</span>
                                <strong>{formatCurrency(total)}</strong>
                                <span className={debtScheduleNeedsReview ? styles.debtSummaryWarning : styles.debtSummaryReady}>
                                    {debtScheduleNeedsReview ? "El cronograma requiere revisión" : "Cronograma válido"}
                                </span>
                            </div>
                            <button ref={debtModalDoneRef} type="button" className={styles.debtModalDone} onClick={() => setShowDebtModal(false)}>
                                Guardar y volver
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════
          MODAL — búsqueda de productos (F2)
      ══════════════════════════════════════════════════ */}
            <ProductSearchModal
                open={showProductModal}
                products={products as any}
                loading={loadingProducts}
                searchValue={productSearch}
                onSearchChange={(v) => setProductSearch(v)}
                onSelect={(p) => addProduct(p as Product)}
                onClose={() => {
                    setShowProductModal(false)
                    setProductSearch("")
                }}
                priceColumn="cost"
                extraHints={<span><kbd>F8</kbd> Último precio</span>}
                onExtraKeyDown={(e, selectedProduct) => {
                    if (e.key === "F8" && selectedProduct) {
                        e.preventDefault()
                        priceHistory.openFor(selectedProduct.id, selectedProduct.name)
                    }
                }}
            />

            {/* Confirm Modal */}
            {showConfirmModal && (
                <div className={styles.modalOverlay}>
                    <div data-pos-modal className={styles.confirmModal}>
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
                    <div data-pos-modal className={styles.confirmModal} onClick={e => e.stopPropagation()}>
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

            {zeroCostProducts.length > 0 && (
                <ZeroCostWarningModal
                    productNames={zeroCostProducts}
                    onClose={() => setZeroCostProducts([])}
                />
            )}

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
