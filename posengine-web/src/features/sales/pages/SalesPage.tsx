"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useHydrated } from "@/src/shared/hooks/useHydrated"
import { AlertCircle, X } from "lucide-react"
import { Header } from "@/src/shared/components/Header"
import { ProductSearchModal } from "@/src/shared/components/ProductSearchModal"
import { CustomerSearchModal } from "@/src/shared/components/CustomerSearchModal"
import { useRouter } from "next/navigation"
import { useCashSession } from "@/src/features/cash-session/hooks/useCashSession"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import { clearIdempotencyKey, prepareIdempotencyKey } from "@/src/shared/api/idempotency"
import styles from "./SalesPage.module.css"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
import { PriceTypeSelectorModal } from "../components/PriceTypeSelectorModal"
import { SaleItemsTable } from "../components/SaleItemsTable"
import { SaleConfirmModal } from "../components/SaleConfirmModal"

const API_BASE = API_BASE_URL
const SALE_STORAGE_KEY = "posengine_sale_draft"

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

export function SalesPage() {
  const { accessToken, user } = useAuthStore()
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
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<"" | "CASH" | "TRANSFER">("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerTotal, setCustomerTotal] = useState(0)
  const [customerPage, setCustomerPage] = useState(1)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")

  // ── Barcode scanner ────────────────────────────────────────────────────────
  const [barcodeBuffer, setBarcodeBuffer] = useState("")
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Refs ───────────────────────────────────────────────────────────────────
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
  const fetchProducts = useCallback(async (search: string, signal: AbortSignal) => {
    setLoadingProducts(true)
    try {
      const params = new URLSearchParams({ limit: "30", isActive: "true" })
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

  // ── Search customers for the point of sale ─────────────────────────────────
  useEffect(() => {
    if (!showCustomerModal || !accessToken) return

    const controller = new AbortController()
    let debounce: ReturnType<typeof setTimeout> | undefined
    setLoadingCustomers(true)

    const loadCustomers = async () => {
      const params = new URLSearchParams({ page: String(customerPage), limit: "10" })
      if (customerSearch.trim()) params.set("search", customerSearch.trim())
      try {
        const res = await fetch(`${API_BASE}/customers?${params}`, {
          headers: authHeaders,
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("Error al cargar clientes")
        const data = await res.json()
        if (!controller.signal.aborted) {
          setCustomers(data.items ?? [])
          setCustomerTotal(data.total ?? 0)
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("Error loading customers", err)
      } finally {
        if (!controller.signal.aborted) setLoadingCustomers(false)
      }
    }

    if (customerSearch.trim()) debounce = setTimeout(() => void loadCustomers(), 250)
    else void loadCustomers()

    return () => {
      if (debounce) clearTimeout(debounce)
      controller.abort()
    }
  }, [accessToken, showCustomerModal, customerPage, customerSearch])

  // ── Agregar producto ───────────────────────────────────────────────────────
  const addProduct = useCallback((product: Product) => {
    setShowProductModal(false)
    setProductSearch("")

    setItems(prev => {
      const existing = prev.findIndex(i => i.product.id === product.id)
      if (existing >= 0) {
        return prev.map((item, idx) =>
          idx === existing ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { product, quantity: 1, unitPrice: product.price, priceType: "PUBLIC" }]
    })
  }, [])

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
    if (paymentMethod === "CREDIT" && amountPaid > 0 && !initialPaymentMethod) {
      setSubmitError("Seleccioná efectivo o transferencia para registrar la seña.")
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
        initialPaymentMethod:
          paymentMethod === "CREDIT" && amountPaid > 0 ? initialPaymentMethod : undefined,
      }

      const idempotencyKey = await prepareIdempotencyKey("SALE_CREATE", user?.id ?? "", user?.tenantId, payload)
      const res = await fetch(`${API_BASE}/sales`, {
        method: "POST",
        headers: { ...authHeaders, "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status >= 400 && res.status < 500 && res.status !== 409) {
          clearIdempotencyKey("SALE_CREATE", user?.id ?? "", user?.tenantId)
        }
        throw new Error(readApiError(body))
      }

      clearIdempotencyKey("SALE_CREATE", user?.id ?? "", user?.tenantId)
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

      if (priceSelectorIndex !== null) return

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
        openProductModal()
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
  }, [showProductModal, showConfirmModal, barcodeBuffer, barcodeError, items, handleBarcodeAdd, paymentMethod, selectedCustomerId, priceSelectorIndex, openProductModal])

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

        <SaleItemsTable
          items={items}
          setItems={setItems}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          selectedCustomer={selectedCustomer}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
          onOpenProductModal={openProductModal}
          total={total}
          submitting={submitting}
          success={success}
          salesDisabled={salesDisabled}
          onOpenConfirmModal={() => setShowConfirmModal(true)}
          onTriggerPriceSelector={setPriceSelectorIndex}
        />
      </div>

      {/* ══ MODAL BÚSQUEDA DE PRODUCTOS (F2) ═════════════════════════════════ */}
      <ProductSearchModal
        open={showProductModal}
        products={products as any}
        loading={loadingProducts}
        searchValue={productSearch}
        onSearchChange={setProductSearch}
        onSelect={(p) => addProduct(p as Product)}
        onClose={() => { setShowProductModal(false); setProductSearch("") }}
        priceColumn="price"
      />

      {/* ══ MODAL SELECCIÓN CLIENTE (F8) ═════════════════════════════════════ */}
      <CustomerSearchModal
        open={showCustomerModal}
        customers={customers}
        totalItems={customerTotal}
        page={customerPage}
        loading={loadingCustomers}
        searchValue={customerSearch}
        onSearchChange={(value) => {
          setCustomerSearch(value)
          setCustomerPage(1)
        }}
        onPageChange={setCustomerPage}
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
        <SaleConfirmModal
          total={total}
          paymentMethod={paymentMethod}
          selectedCustomer={selectedCustomer}
          amountPaid={amountPaid}
          onAmountPaidChange={setAmountPaid}
          initialPaymentMethod={initialPaymentMethod}
          onInitialPaymentMethodChange={setInitialPaymentMethod}
          confirmSelectedBtn={confirmSelectedBtn}
          amountPaidInputRef={amountPaidInputRef}
          confirmAcceptRef={confirmAcceptRef}
          confirmCancelRef={confirmCancelRef}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={() => {
            setShowConfirmModal(false)
            void handleSubmit()
          }}
        />
      )}

      {/* ══ MODAL BARCODE ERROR ══════════════════════════════════════════════ */}
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
            <div className={styles.confirmHint}><kbd>Enter</kbd> o <kbd>Esc</kbd> para cerrar</div>
          </div>
        </div>
      )}
    </div>
  )
}
