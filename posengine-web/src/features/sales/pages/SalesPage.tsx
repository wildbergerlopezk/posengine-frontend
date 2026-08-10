"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useHydrated } from "@/src/shared/hooks/useHydrated"
import {
  Trash2,
  ShoppingCart,
  Check,
  X,
  AlertCircle,
  Plus,
  Loader2,
  User,
} from "lucide-react"
import { Header } from "@/src/shared/components/Header"
import { ProductSearchModal } from "@/src/shared/components/ProductSearchModal"
import { CustomerSearchModal } from "@/src/shared/components/CustomerSearchModal"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { useRouter } from "next/navigation"
import { useCashSession } from "@/src/features/cash-session/hooks/useCashSession"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import styles from "./SalesPage.module.css"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
import { PriceTypeSelectorModal } from "../components/PriceTypeSelectorModal"
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "@/components/ui/autocomplete"

const API_BASE = API_BASE_URL
const SALE_STORAGE_KEY = "posengine_sale_draft"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  barcode?: string
  sku?: string
  price: number
  wholesalePrice: number
  cost?: number
  stock: number
  unitType: "UNIT" | "KG" | "G" | "L" | "ML" | "MG"
}

interface SaleItem {
  product: Product
  quantity: number
  unitPrice: number
  priceType: "PUBLIC" | "WHOLESALE"
}

interface Customer {
  id: string
  name: string
  creditEnabled: boolean
  creditLimit: number
  currentDebt: number
  documentNumber?: string
}

function readApiError(body: unknown): string {
  if (!body || typeof body !== "object") return "Error en la solicitud"
  const b = body as { message?: unknown; error?: string }
  if (Array.isArray(b.message)) return b.message.map(String).join(" · ")
  if (typeof b.message === "string") return b.message
  if (typeof b.error === "string") return b.error
  return "Error en la solicitud"
}

function isUnitType(unitType: string) {
  return unitType === "UNIT"
}

function formatQuantity(qty: number, unitType: string) {
  if (isUnitType(unitType)) return String(qty)
  return qty % 1 === 0 ? String(qty) : qty.toFixed(3)
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SalesPage() {
  const { accessToken } = useAuthStore()
  const router = useRouter()
  const { session, loading: sessionLoading } = useCashSession()
  const canOperate = !!session
  const salesDisabled = !session && !sessionLoading

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  // ── Items ──────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<SaleItem[]>([])

  // ── Edición inline ─────────────────────────────────────────────────────────
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [editingField, setEditingField] = useState<"quantity" | "unitPrice" | null>(null)
  const [editingValue, setEditingValue] = useState("")

  // ── Modal de productos ─────────────────────────────────────────────────────
  const [showProductModal, setShowProductModal] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // ── Submit ─────────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmSelectedBtn, setConfirmSelectedBtn] = useState<"accept" | "cancel">("accept")

  // ── Crédito / Contado ──────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CREDIT">("CASH")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [amountPaid, setAmountPaid] = useState<number>(0)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")

  // ── Barcode scanner ────────────────────────────────────────────────────────
  const [barcodeBuffer, setBarcodeBuffer] = useState("")
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const editingInputRef = useRef<HTMLInputElement>(null)
  const confirmAcceptRef = useRef<HTMLButtonElement>(null)
  const confirmCancelRef = useRef<HTMLButtonElement>(null)
  const amountPaidInputRef = useRef<HTMLInputElement>(null)
  const isHydrated = useHydrated()
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)

  // ── Modal de selección de precio ──────────────────────────────────────────
  const [priceSelectorIndex, setPriceSelectorIndex] = useState<number | null>(null)

  // ── Persistence: Load draft ───────────────────────────────────────────────
  useEffect(() => {
    if (!isHydrated) return

    const saved = sessionStorage.getItem(SALE_STORAGE_KEY)
    if (saved) {
      try {
        const draft = JSON.parse(saved)
        if (draft.items) setItems(draft.items)
      } catch (e) {
        console.error("Error loading sale draft", e)
      }
    }
    setIsDraftLoaded(true)
  }, [isHydrated])

  // ── Persistence: Save draft ───────────────────────────────────────────────
  useEffect(() => {
    if (!isDraftLoaded) return
    const draft = { items }
    sessionStorage.setItem(SALE_STORAGE_KEY, JSON.stringify(draft))
  }, [isDraftLoaded, items])

  // ── Totales ────────────────────────────────────────────────────────────────
  const total = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0)

  // ── Fetch productos para el modal ──────────────────────────────────────────
  const fetchProducts = useCallback(async (search: string) => {
    setLoadingProducts(true)
    try {
      const params = new URLSearchParams({ limit: "30", isActive: "true" })
      if (search.trim()) params.set("search", search.trim())
      const res = await fetch(`${API_BASE}/product?${params}`, { headers: authHeaders })
      if (res.ok) {
        const data = await res.json()
        setProducts(data.items ?? data)
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
      fetchProducts("")
    }
  }, [showProductModal, fetchProducts])



  // ── Fetch clientes para el punto de venta ───────────────────────────────────
  useEffect(() => {
    if (accessToken) {
      fetch(`${API_BASE}/customers?limit=150`, { headers: authHeaders })
        .then(res => res.json())
        .then(data => setCustomers(data.items ?? []))
        .catch(err => console.error("Error loading customers", err))
    }
  }, [accessToken])

  // ── Edición inline ─────────────────────────────────────────────────────────
  const cancelEdit = useCallback(() => {
    setEditingRowIndex(null)
    setEditingField(null)
    setEditingValue("")
  }, [])

  const startEdit = useCallback((index: number, field: "quantity" | "unitPrice", current: number) => {
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

      if (editingField === "quantity") {
        const product = item.product
        // Si es UNIT, forzar entero
        const qty = isUnitType(product.unitType) ? Math.round(val) : val
        return { ...item, quantity: qty }
      }

      if (editingField === "unitPrice") {
        // No se puede bajar del precio base
        const safePrice = Math.max(val, item.product.price)
        return { ...item, unitPrice: safePrice }
      }

      return item
    }))

    const targetIndex = editingRowIndex
    const wasQuantityEdit = editingField === "quantity"
    cancelEdit()

    if (wasQuantityEdit && targetIndex !== null) {
      setPriceSelectorIndex(targetIndex)
    }
  }, [editingRowIndex, editingField, editingValue, cancelEdit])

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
    cancelEdit()
  }

  // ── Agregar producto ───────────────────────────────────────────────────────
  const addProduct = useCallback((product: Product) => {
    setShowProductModal(false)
    setProductSearch("")

    setItems(prev => {
      const existing = prev.findIndex(i => i.product.id === product.id)
      if (existing >= 0) {
        const newQty = isUnitType(product.unitType)
          ? prev[existing].quantity + 1
          : prev[existing].quantity + 1
        setTimeout(() => startEdit(existing, "quantity", newQty), 50)
        return prev.map((item, idx) =>
          idx === existing ? { ...item, quantity: newQty } : item
        )
      }
      const newIndex = prev.length
      setTimeout(() => startEdit(newIndex, "quantity", 1), 50)
      return [...prev, { product, quantity: 1, unitPrice: product.price, priceType: "PUBLIC" }]
    })
  }, [startEdit])

  // ── Barcode scanner ────────────────────────────────────────────────────────
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
      addProduct(product)
    } catch {
      setBarcodeError(`Error al buscar el producto con código "${code}"`)
    }
  }, [accessToken, addProduct])

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canOperate) { setSubmitError("Abrí caja antes de registrar ventas"); return }
    if (items.length === 0) { setSubmitError("Agregá al menos un producto"); return }
    if (paymentMethod === "CREDIT" && !selectedCustomerId) {
      setSubmitError("Debes seleccionar un cliente para ventas a crédito.")
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        items: items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          priceType: i.priceType,
        })),
        paymentMethod,
        customerId: selectedCustomerId || undefined,
        amountPaid: paymentMethod === "CREDIT" ? amountPaid : undefined,
      }

      const res = await fetch(`${API_BASE}/sales`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(readApiError(body))
      }

      setSuccess(true)
      setTimeout(() => {
        setItems([])
        sessionStorage.removeItem(SALE_STORAGE_KEY)
        setSuccess(false)
        setSelectedCustomerId("")
        setSelectedCustomer(null)
        setAmountPaid(0)
      }, 1200)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Error al guardar la venta")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Teclado global ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName
      const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA"

      // Evitar atajos si el selector de precio está abierto
      if (priceSelectorIndex !== null) return

      // Barcode scanner — solo cuando no hay modal ni edición activa
      if (!showProductModal && !showConfirmModal && !isTyping) {
        if (e.key === "Enter" && barcodeBuffer.trim()) {
          e.preventDefault()
          const code = barcodeBuffer.trim()
          setBarcodeBuffer("")
          if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current)
          void handleBarcodeAdd(code)
          return
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current)
          setBarcodeBuffer(prev => prev + e.key)
          barcodeTimerRef.current = setTimeout(() => setBarcodeBuffer(""), 100)
          return
        }
      }

      if (e.key === "Escape") {
        if (barcodeError) { setBarcodeError(null); return }
        if (showProductModal) {
          setShowProductModal(false)
          setProductSearch("")
          return
        }
      }
      if (e.key === "F9") {
        e.preventDefault()
        setPaymentMethod(prev => prev === "CASH" ? "CREDIT" : "CASH")
      }
      if (e.key === "F8" && !showProductModal && !showConfirmModal) {
        e.preventDefault()
        setShowCustomerModal(true)
      }
      if (e.key === "F2" && !showProductModal) {
        e.preventDefault()
        setShowProductModal(true)
      }
      if (e.key === "F12" && !showProductModal && items.length > 0 && !showConfirmModal) {
        e.preventDefault()
        if (paymentMethod === "CREDIT" && !selectedCustomerId) {
          setSubmitError("Debes seleccionar un cliente (F8) para realizar una venta a crédito.")
          return
        }
        setShowConfirmModal(true)
        setConfirmSelectedBtn("accept")
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [showProductModal, showConfirmModal, barcodeBuffer, barcodeError, items, handleBarcodeAdd, paymentMethod, selectedCustomerId])

  // ── Confirm modal teclado ──────────────────────────────────────────────────
  useEffect(() => {
    if (!showConfirmModal) return
    const handler = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isClientInput = activeEl?.id === "autocomplete-input-client"
      const isAmountInput = activeEl?.id === "amount-paid-input"
      const isButton = activeEl === confirmAcceptRef.current || activeEl === confirmCancelRef.current
      const isPopupOpen = !!document.querySelector('[id^="autocomplete-popup-"]')

      if (e.key === "ArrowDown") {
        if (paymentMethod === "CREDIT") {
          if (isClientInput && !isPopupOpen) {
            e.preventDefault()
            amountPaidInputRef.current?.focus()
          } else if (isAmountInput) {
            e.preventDefault()
            confirmAcceptRef.current?.focus()
            setConfirmSelectedBtn("accept")
          } else if (isButton) {
            e.preventDefault()
            document.getElementById("autocomplete-input-client")?.focus()
          }
        } else {
          e.preventDefault()
          setConfirmSelectedBtn(prev => prev === "accept" ? "cancel" : "accept")
        }
      } else if (e.key === "ArrowUp") {
        if (paymentMethod === "CREDIT") {
          if (isAmountInput) {
            e.preventDefault()
            document.getElementById("autocomplete-input-client")?.focus()
          } else if (isButton) {
            e.preventDefault()
            amountPaidInputRef.current?.focus()
          }
        } else {
          e.preventDefault()
          setConfirmSelectedBtn(prev => prev === "accept" ? "cancel" : "accept")
        }
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        setConfirmSelectedBtn(prev => prev === "accept" ? "cancel" : "accept")
      }

      if (e.key === "Enter") {
        e.preventDefault()
        if (confirmSelectedBtn === "accept") {
          if (paymentMethod === "CREDIT" && !selectedCustomerId) {
            alert("Debes seleccionar un cliente para ventas a crédito.")
            return
          }
          if (paymentMethod === "CREDIT" && selectedCustomer && (selectedCustomer.currentDebt + Math.max(0, total - amountPaid) > selectedCustomer.creditLimit)) {
            return
          }
          setShowConfirmModal(false)
          void handleSubmit()
        }
        else { setShowConfirmModal(false) }
      }
      if (e.key === "Escape") { e.preventDefault(); setShowConfirmModal(false) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [showConfirmModal, confirmSelectedBtn, selectedCustomerId, selectedCustomer, paymentMethod, amountPaid, handleSubmit, total])

  useEffect(() => {
    if (showConfirmModal) {
      setTimeout(() => {
        if (confirmSelectedBtn === "accept") confirmAcceptRef.current?.focus()
        else confirmCancelRef.current?.focus()
      }, 80)
    }
  }, [showConfirmModal, confirmSelectedBtn])

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <Header title="Nueva venta" />

      {/* Modal de selección de precio */}
      {priceSelectorIndex !== null && (
        <PriceTypeSelectorModal
          product={items[priceSelectorIndex].product}
          onSelect={(type, price) => {
            setItems(prev => prev.map((it, i) =>
              i === priceSelectorIndex ? { ...it, priceType: type, unitPrice: price } : it
            ))
            setPriceSelectorIndex(null)
          }}
          onClose={() => setPriceSelectorIndex(null)}
        />
      )}

      <div className={styles.container}>

        {/* Bloqueo sin caja */}
        {salesDisabled && (
          <div className={styles.blockNotice}>
            <div>
              <AlertCircle size={32} className={styles.noticeIcon} />
              <h2>No hay caja abierta</h2>
              <p>Abrí caja antes de comenzar a registrar ventas.</p>
              <button className={styles.openCashLink} onClick={() => router.push("/dashboard/cash")}>
                Abrir caja
              </button>
            </div>
          </div>
        )}

        {/* Error banner */}
        {submitError && (
          <div className={tableStyles.errorBanner}>
            <AlertCircle size={16} />
            {submitError}
            <button type="button" className={styles.bannerClose} onClick={() => setSubmitError(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ══ TABLA DE ITEMS ═══════════════════════════════════════════════════ */}
        <div className={`${tableStyles.tableCard} ${salesDisabled ? styles.disabledArea : ""}`}>

          {/* Toolbar */}
          <div className={styles.itemsToolbar}>
            <span className={styles.itemsTitle}>
              Productos <span className={styles.itemsCount}>{items.length}</span>
            </span>
            <div className={styles.itemsActions}>
              <span className={styles.shortcutHint}><kbd>F12</kbd> Cobrar</span>
              <button
                type="button"
                className={`${tableStyles.newButton} ${selectedCustomer ? styles.creditModeBtn : styles.cashModeBtn}`}
                onClick={() => setShowCustomerModal(true)}
                style={{ marginLeft: 8 }}
              >
                Cliente: {selectedCustomer ? selectedCustomer.name : "Consumidor Final"} <kbd className={styles.kbdInline} style={{ marginLeft: 6 }}>F8</kbd>
              </button>
              <button
                type="button"
                className={`${tableStyles.newButton} ${paymentMethod === "CREDIT" ? styles.creditModeBtn : styles.cashModeBtn}`}
                onClick={() => setPaymentMethod(prev => prev === "CASH" ? "CREDIT" : "CASH")}
                style={{ marginLeft: 8 }}
              >
                Tipo de venta: {paymentMethod === "CASH" ? "Contado" : "Crédito"} <kbd className={styles.kbdInline} style={{ marginLeft: 6 }}>F9</kbd>
              </button>
              <button
                type="button"
                className={tableStyles.newButton}
                onClick={() => setShowProductModal(true)}
                style={{ marginLeft: 8 }}
              >
                <Plus size={15} /> Agregar producto <span className={styles.shortcutHint}><kbd>F2</kbd></span>
              </button>
            </div>
          </div>
          {paymentMethod === "CREDIT" && selectedCustomer && (selectedCustomer.currentDebt + Math.max(0, total - amountPaid) > selectedCustomer.creditLimit) && (
            <div className={tableStyles.errorBanner} style={{ marginTop: 8, marginBottom: 8 }}>
              <AlertCircle size={16} />
              Límite de crédito superado para {selectedCustomer.name}. Disponible: {formatCurrency(Math.max(0, selectedCustomer.creditLimit - selectedCustomer.currentDebt))}, Requerido: {formatCurrency(Math.max(0, total - amountPaid))}
            </div>
          )}

          <table className={tableStyles.table}>
            <thead className={tableStyles.tableHeader}>
              <tr>
                <th className={tableStyles.tableHeaderCell} style={{ width: 40 }}>#</th>
                <th className={tableStyles.tableHeaderCell} style={{ width: 130 }}>Código</th>
                <th className={tableStyles.tableHeaderCell}>Descripción</th>
                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 110 }}>Cant.</th>
                <th className={tableStyles.tableHeaderCell} style={{ width: 100 }}>Venta</th>
                <th className={tableStyles.tableHeaderCell} style={{ width: 100 }}>Tipo</th>
                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 140 }}>Precio unit.</th>
                <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight}`} style={{ width: 140 }}>SubTotal</th>
                <th className={tableStyles.tableHeaderCell} style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className={tableStyles.emptyState}>
                      <ShoppingCart size={36} className={tableStyles.emptyStateIcon} />
                      <p className={tableStyles.emptyStateTitle}>Sin productos</p>
                      <p>Escaneá un código de barras o presioná <kbd className={styles.kbdInline}>F2</kbd> para buscar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.product.id} className={tableStyles.tableRow}>

                    <td className={tableStyles.tableCell}>
                      <span className={styles.rowNum}>{idx + 1}</span>
                    </td>

                    <td className={tableStyles.tableCell}>
                      <span className={styles.codeChip}>{item.product.barcode || item.product.sku || "—"}</span>
                    </td>

                    <td className={tableStyles.tableCell}>
                      <span style={{ fontWeight: 500 }}>{item.product.name}</span>
                      {item.product.unitType !== "UNIT" && (
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
                              e.preventDefault(); 
                              e.stopPropagation();
                              commitEdit();
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

                    {/* Modo de venta (Contado / Crédito) */}
                    <td className={tableStyles.tableCell}>
                      <span className={paymentMethod === "CREDIT" ? styles.creditBadgeInline : styles.cashBadgeInline}>
                        {paymentMethod === "CREDIT" ? "Crédito" : "Contado"}
                      </span>
                    </td>

                    <td className={tableStyles.tableCell}>
                      <button
                        type="button"
                        className={`${styles.priceTypeBtn} ${item.priceType === "WHOLESALE" ? styles.priceTypeBtnWholesale : ""}`}
                        onClick={() => setItems(prev => prev.map((it, i) => {
                          if (i !== idx) return it
                          const newType = it.priceType === "PUBLIC" ? "WHOLESALE" : "PUBLIC"
                          const newPrice = newType === "WHOLESALE" ? it.product.wholesalePrice : it.product.price
                          return { ...it, priceType: newType, unitPrice: newPrice }
                        }))}
                        title="Cambiar tipo de precio (Público/Mayorista)"
                      >
                        {item.priceType === "WHOLESALE" ? "Mayorista" : "Público"}
                      </button>
                    </td>

                    {/* Precio unitario — editable inline */}
                    <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                      {editingRowIndex === idx && editingField === "unitPrice" ? (
                        <input
                          ref={editingInputRef}
                          className={styles.inlineInput}
                          type="number"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commitEdit() }
                            if (e.key === "Escape") cancelEdit()
                          }}
                          onBlur={commitEdit}
                          min={item.product.price}
                          step="any"
                        />
                      ) : (
                        <button
                          type="button"
                          className={`${styles.editableCell} ${item.unitPrice > item.product.price ? styles.editableCellModified : ""}`}
                          onClick={() => startEdit(idx, "unitPrice", item.unitPrice)}
                          title={`Precio base: ${formatCurrency(item.product.price)}. Clic para modificar (solo se puede subir)`}
                        >
                          {formatCurrency(item.unitPrice)}
                        </button>
                      )}
                    </td>

                    <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                      <strong>{formatCurrency(item.quantity * item.unitPrice)}</strong>
                    </td>

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

          {/* Footer totales */}
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
                  onClick={() => { setShowConfirmModal(true); setConfirmSelectedBtn("accept") }}
                  disabled={submitting || success}
                >
                  {success
                    ? <><Check size={15} /> Guardado</>
                    : submitting
                      ? <><Loader2 size={15} className={tableStyles.spinner} /> Guardando…</>
                      : <><Check size={15} /> Cobrar <kbd className={styles.kbdWhite}>F12</kbd></>
                  }
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ══ MODAL BÚSQUEDA DE PRODUCTOS (F2) ═════════════════════════════════ */}
      <ProductSearchModal
        open={showProductModal}
        products={products as any}
        loading={loadingProducts}
        searchValue={productSearch}
        onSearchChange={(v) => setProductSearch(v)}
        onSelect={(p) => addProduct(p as Product)}
        onClose={() => { setShowProductModal(false); setProductSearch("") }}
        priceColumn="price"
      />

      {/* ══ MODAL SELECCIÓN CLIENTE (F8) ═════════════════════════════════════ */}
      <CustomerSearchModal
        open={showCustomerModal}
        customers={customers}
        searchValue={customerSearch}
        onSearchChange={(v) => setCustomerSearch(v)}
        onSelect={(c) => {
          setSelectedCustomer(c)
          setSelectedCustomerId(c?.id || "")
          setShowCustomerModal(false)
          setCustomerSearch("")
        }}
        onClose={() => {
          setShowCustomerModal(false)
          setCustomerSearch("")
        }}
      />

      {/* ══ MODAL CONFIRMAR VENTA ════════════════════════════════════════════ */}
      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <div className={styles.confirmIcon}>
              <AlertCircle size={40} />
            </div>
            <h2 className={styles.confirmTitle}>¿Confirmar venta?</h2>
            <p className={styles.confirmDescription}>
              Total: <strong>{formatCurrency(total)}</strong>
            </p>
            {paymentMethod === "CREDIT" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", marginBottom: "1rem", textAlign: "left" }}>
                <div>
                  <span style={{ fontSize: "0.825rem", color: "var(--color-muted-foreground)", fontWeight: 600, display: "block" }}>
                    Cliente seleccionado
                  </span>
                  <div style={{ fontSize: "1rem", fontWeight: 700, padding: "0.5rem", borderRadius: "0.25rem", background: "var(--color-muted, #f3f4f6)", color: "var(--color-foreground)" }}>
                    {selectedCustomer ? selectedCustomer.name : "Consumidor Final"}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "0.825rem", color: "var(--color-muted-foreground)", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                    Monto abonado / Seña (Gs.)
                  </label>
                  <input
                    id="amount-paid-input"
                    ref={amountPaidInputRef}
                    type="number"
                    min="0"
                    max={total}
                    value={amountPaid || ""}
                    onChange={e => setAmountPaid(Number(e.target.value) || 0)}
                    placeholder="0"
                    style={{
                      width: "100%",
                      height: "2.5rem",
                      borderRadius: "0.375rem",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-background)",
                      color: "var(--color-foreground)",
                      padding: "0 0.5rem",
                      fontSize: "0.875rem"
                    }}
                  />
                </div>
              </div>
            )}
            <div className={styles.confirmButtons}>
              <button
                ref={confirmCancelRef}
                className={`${styles.confirmCancel} ${confirmSelectedBtn === "cancel" ? styles.buttonFocused : ""}`}
                onClick={() => setShowConfirmModal(false)}
              >
                Cancelar
              </button>
              <button
                ref={confirmAcceptRef}
                className={`${styles.confirmAccept} ${confirmSelectedBtn === "accept" ? styles.buttonFocused : ""}`}
                disabled={paymentMethod === "CREDIT" && selectedCustomer !== null && (selectedCustomer.currentDebt + Math.max(0, total - amountPaid) > selectedCustomer.creditLimit)}
                style={{
                  opacity: (paymentMethod === "CREDIT" && selectedCustomer !== null && (selectedCustomer.currentDebt + Math.max(0, total - amountPaid) > selectedCustomer.creditLimit)) ? 0.5 : 1,
                  cursor: (paymentMethod === "CREDIT" && selectedCustomer !== null && (selectedCustomer.currentDebt + Math.max(0, total - amountPaid) > selectedCustomer.creditLimit)) ? "not-allowed" : "pointer"
                }}
                onClick={() => {
                  if (paymentMethod === "CREDIT" && !selectedCustomerId) {
                    alert("Debes seleccionar un cliente para ventas a crédito.")
                    return
                  }
                  setShowConfirmModal(false)
                  void handleSubmit()
                }}
              >
                Confirmar
              </button>
            </div>
            <div className={styles.confirmHint}>
              <kbd>←→</kbd> Navegar <kbd>Enter</kbd> Confirmar <kbd>Esc</kbd> Cancelar
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL BARCODE ERROR ══════════════════════════════════════════════ */}
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
            <div className={styles.confirmHint}><kbd>Enter</kbd> o <kbd>Esc</kbd> para cerrar</div>
          </div>
        </div>
      )}
    </div>
  )
}
