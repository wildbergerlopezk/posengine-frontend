"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Header } from "@/src/shared/components/Header"
import { ImageDropPasteArea } from "@/src/shared/components/ImageDropPasteArea"
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, Package,
  AlertTriangle, UploadCloud, Loader2, AlertCircle, Tag, EyeOff, Eye
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import type { Product, Category, UnitType } from "@/src/shared/types"
import dataTableStyles from "@/src/shared/components/DataTable/DataTable.module.css"
import styles from "./ProductsPage.module.css"

const API_BASE = API_BASE_URL

const UNIT_OPTIONS: Array<{ value: UnitType; label: string; hint: string }> = [
  { value: "UNIT", label: "Unidad", hint: "Solo cantidades enteras" },
  { value: "KG", label: "Kilogramo (kg)", hint: "Permite decimales" },
  { value: "G", label: "Gramo (g)", hint: "Permite decimales" },
  { value: "L", label: "Litro (l)", hint: "Permite decimales" },
  { value: "ML", label: "Mililitro (ml)", hint: "Permite decimales" },
  { value: "MG", label: "Miligramo (mg)", hint: "Permite decimales" },
]

const UNIT_LABELS: Record<UnitType, string> = {
  UNIT: "Unidad",
  KG: "kg",
  G: "g",
  L: "l",
  ML: "ml",
  MG: "mg",
}

function isUnitType(unitType: UnitType) {
  return unitType === "UNIT"
}

function formatStock(value: number, unitType: UnitType = "UNIT") {
  const formatted = isUnitType(unitType) || value % 1 === 0
    ? String(value)
    : String(Number(value.toFixed(3)))
  return `${formatted} ${UNIT_LABELS[unitType]}`
}

interface ProductWithRelations extends Product {
  category?: { id: string; name: string }
  subcategory?: { id: string; name: string } | null
  supplierId?: string | null
  supplier?: { id: string; name: string } | null
  sku?: string
  taxRate?: number
  isActive: boolean
}

interface ConfirmState {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
}

type ProductFormErrorField = "name" | "barcode" | "categoryId" | "cost" | "price" | "stock" | "stockMinimum"
type ProductFormErrors = Partial<Record<ProductFormErrorField, string>>

const PRODUCTS_PAGE_SIZE = 20

interface ProductListResponse {
  items: ProductWithRelations[]
  total: number
}

interface ProductListRequest {
  page: number
  search: string
  accessToken: string
  controller: AbortController
  promise: Promise<ProductListResponse>
}

export function ProductsPage() {
  const { accessToken } = useAuthStore()
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hasCompletedProductLoad, setHasCompletedProductLoad] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [reloadVersion, setReloadVersion] = useState(0)
  const totalPages = Math.ceil(total / PRODUCTS_PAGE_SIZE)
  const isSearchPending = searchQuery.trim() !== debouncedSearchQuery
  const productRequestRef = useRef<ProductListRequest | null>(null)
  const productRequestGenerationRef = useRef(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithRelations | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [focusedDetails, setFocusedDetails] = useState<{ productId: string; top: number; left: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const toggleDropdown = (productId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    setFocusedDetails(null)
    if (openDropdown === productId) {
      setOpenDropdown(null)
      setDropdownPos(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.right - 160 })
    setOpenDropdown(productId)
  }

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<ProductFormErrors>({})
  const [uploadingImage, setUploadingImage] = useState(false)

  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false, title: "", description: "", onConfirm: () => { },
  })

  const openConfirm = (title: string, description: string, onConfirm: () => void) =>
    setConfirm({ open: true, title, description, onConfirm })

  const closeConfirm = () => setConfirm((prev) => ({ ...prev, open: false }))

  const [formData, setFormData] = useState({
    name: "", barcode: "", categoryId: "", subcategoryId: "", supplierId: "",
    price: "", cost: "", wholesalePrice: "",
    stock: "", stockMinimum: "", imageUrl: "",
    unitType: "UNIT" as UnitType, stockNotes: "",
  })
  const [publicMargin, setPublicMargin] = useState("")
  const [wholesaleMargin, setWholesaleMargin] = useState("")

  // ─── Keyboard navigation refs ─────────────────────────────────────────────
  const nameRef = useRef<HTMLInputElement>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)
  const subcategoryRef = useRef<HTMLSelectElement>(null)
  const supplierRef = useRef<HTMLSelectElement>(null)
  const costRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  const wholesalePriceRef = useRef<HTMLInputElement>(null)
  const publicMarginRef = useRef<HTMLInputElement>(null)
  const wholesaleMarginRef = useRef<HTMLInputElement>(null)
  const unitTypeRef = useRef<HTMLSelectElement>(null)
  const stockRef = useRef<HTMLInputElement>(null)
  const stockMinRef = useRef<HTMLInputElement>(null)
  const stockNotesRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)

  const handleEnterKey = (
    e: React.KeyboardEvent,
    nextRef: React.RefObject<HTMLElement | null>,
    fallbackRef?: React.RefObject<HTMLElement | null>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault()
      setTimeout(() => {
        const nextEl = nextRef.current
        if (nextEl && !(nextEl as any).disabled) {
          nextEl.focus()
        } else if (fallbackRef?.current) {
          fallbackRef.current.focus()
        }
      }, 50)
    }
  }

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  const fetchProducts = useCallback(async (
    page: number,
    search: string,
    signal: AbortSignal,
  ): Promise<ProductListResponse> => {
    const params = new URLSearchParams({
      limit: String(PRODUCTS_PAGE_SIZE),
      page: String(page),
      ...(search && { search }),
    })
    const res = await fetch(`${API_BASE}/product?${params}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    })
    if (!res.ok) throw new Error("Error al cargar productos")
    const data = await res.json()
    return { items: data.items ?? data, total: data.total ?? 0 }
  }, [accessToken])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/categories?limit=100`, { headers: authHeaders })
      if (res.ok) {
        const data = await res.json()
        setCategories(data.items ?? data)
      }
    } catch (err) {
      console.error("Error al cargar categorías", err)
    }
  }, [accessToken])

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/suppliers?limit=100`, { headers: authHeaders })
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data.items ?? data)
      }
    } catch (err) {
      console.error("Error al cargar proveedores", err)
    }
  }, [accessToken])

  useEffect(() => {
    fetchCategories()
    fetchSuppliers()
  }, [fetchCategories, fetchSuppliers])

  useEffect(() => {
    const normalizedSearch = searchQuery.trim()
    const timer = setTimeout(() => {
      if (normalizedSearch === debouncedSearchQuery) return
      setDebouncedSearchQuery(normalizedSearch)
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [debouncedSearchQuery, searchQuery])

  useEffect(() => {
    if (!accessToken) return

    const generation = ++productRequestGenerationRef.current
    const search = debouncedSearchQuery.trim()
    const previousRequest = productRequestRef.current
    let request = previousRequest

    if (
      !request
      || request.page !== currentPage
      || request.search !== search
      || request.accessToken !== accessToken
      || request.controller.signal.aborted
    ) {
      previousRequest?.controller.abort()
      const controller = new AbortController()
      request = {
        page: currentPage,
        search,
        accessToken,
        controller,
        promise: fetchProducts(currentPage, search, controller.signal),
      }
      productRequestRef.current = request
    }

    let isCurrent = true
    setLoading(true)
    setError(null)

    void request.promise
      .then(({ items, total: nextTotal }) => {
        if (!isCurrent || generation !== productRequestGenerationRef.current || request.controller.signal.aborted) return
        setProducts(items)
        setTotal(nextTotal)
      })
      .catch((err: unknown) => {
        if (!isCurrent || generation !== productRequestGenerationRef.current || request.controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "Error al cargar productos")
      })
      .finally(() => {
        if (productRequestRef.current === request) productRequestRef.current = null
        if (!isCurrent || generation !== productRequestGenerationRef.current || request.controller.signal.aborted) return
        setLoading(false)
        setHasCompletedProductLoad(true)
      })

    return () => {
      isCurrent = false
      // Strict Mode replays effects synchronously in development. The next
      // setup reuses this request; abort only if no setup has reclaimed it.
      queueMicrotask(() => {
        if (generation !== productRequestGenerationRef.current) return
        if (productRequestRef.current !== request) return
        request.controller.abort()
        productRequestRef.current = null
      })
    }
  }, [accessToken, currentPage, debouncedSearchQuery, fetchProducts, reloadVersion])

  // Focus primer campo al abrir modal
  useEffect(() => {
    if (isDialogOpen) setTimeout(() => nameRef.current?.focus(), 100)
  }, [isDialogOpen])

  const selectedCategory = categories.find((c) => c.id === formData.categoryId)
  const subcategories = selectedCategory?.subcategories || []

  const handleCostChange = (val: string) => {
    const c = parseFloat(val)
    const m = parseFloat(publicMargin)
    const wm = parseFloat(wholesaleMargin)

    setFormData(prev => ({
      ...prev,
      cost: val,
      price: (!isNaN(c) && !isNaN(m)) ? String(Math.round(c * (1 + m / 100))) : prev.price,
      wholesalePrice: (!isNaN(c) && !isNaN(wm)) ? String(Math.round(c * (1 + wm / 100))) : prev.wholesalePrice,
    }))
  }

  const handlePublicMarginChange = (val: string) => {
    setPublicMargin(val)
    const c = parseFloat(formData.cost)
    const m = parseFloat(val)
    if (!isNaN(c) && !isNaN(m)) {
      const calculatedPrice = Math.round(c * (1 + m / 100))
      setFormData(prev => ({ ...prev, price: String(calculatedPrice) }))
      if (Number.isFinite(calculatedPrice) && calculatedPrice >= 0) clearFieldError("price")
    }
  }

  const handlePublicPriceChange = (val: string) => {
    setFormData(prev => ({ ...prev, price: val }))
    const c = parseFloat(formData.cost)
    const p = parseFloat(val)
    if (!isNaN(c) && !isNaN(p) && c > 0) {
      setPublicMargin((((p / c) - 1) * 100).toFixed(2))
    }
  }

  const handleWholesaleMarginChange = (val: string) => {
    setWholesaleMargin(val)
    const c = parseFloat(formData.cost)
    const m = parseFloat(val)
    if (!isNaN(c) && !isNaN(m)) {
      setFormData(prev => ({ ...prev, wholesalePrice: String(Math.round(c * (1 + m / 100))) }))
    }
  }

  const handleWholesalePriceChange = (val: string) => {
    setFormData(prev => ({ ...prev, wholesalePrice: val }))
    const c = parseFloat(formData.cost)
    const p = parseFloat(val)
    if (!isNaN(c) && !isNaN(p) && c > 0) {
      setWholesaleMargin((((p / c) - 1) * 100).toFixed(2))
    }
  }

  const resetForm = () => {
    setFormData({
      name: "", barcode: "", categoryId: "", subcategoryId: "", supplierId: "",
      price: "", cost: "", wholesalePrice: "",
      stock: "", stockMinimum: "", imageUrl: "",
      unitType: "UNIT", stockNotes: "",
    })
    setPublicMargin("")
    setWholesaleMargin("")
    setEditingProduct(null)
    setSubmitError(null)
    setFieldErrors({})
  }

  const clearFieldError = (field: ProductFormErrorField) => {
    setFieldErrors((previous) => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
    setSubmitError(null)
  }

  const handleEdit = (product: ProductWithRelations) => {
    const cost = product.cost ?? 0
    const price = product.price ?? 0
    const wholesale = product.wholesalePrice ?? 0

    setPublicMargin(cost > 0 ? (((price / cost) - 1) * 100).toFixed(2) : "")
    setWholesaleMargin(cost > 0 ? (((wholesale / cost) - 1) * 100).toFixed(2) : "")

    setEditingProduct(product)
    setFormData({
      name: product.name,
      barcode: product.barcode || "",
      categoryId: product.categoryId || "",
      subcategoryId: product.subcategoryId || "",
      supplierId: product.supplierId || "",
      price: price.toString(),
      cost: cost.toString(),
      wholesalePrice: wholesale.toString(),
      stock: product.stock?.toString() || "0",
      unitType: product.unitType ?? "UNIT",
      stockMinimum: product.stockMinimum?.toString() || "0",
      imageUrl: product.imageUrl || "",
      stockNotes: "",
    })
    setFieldErrors({})
    setSubmitError(null)
    setIsDialogOpen(true)
    setOpenDropdown(null)
  }

  const handleDelete = (productId: string) => {
    setOpenDropdown(null)
    openConfirm(
      "Eliminar producto",
      "¿Estás seguro? Esta acción no se puede deshacer.",
      async () => {
        closeConfirm()
        try {
          const res = await fetch(`${API_BASE}/product/${productId}`, { method: "DELETE", headers: authHeaders })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.message ?? "Error al eliminar producto")
          }
          setProducts((prev) => prev.filter((p) => p.id !== productId))
        } catch (err: any) {
          openConfirm("Error", err.message, closeConfirm)
        }
      }
    )
  }

  const handleDeactivate = (product: ProductWithRelations) => {
    setOpenDropdown(null)
    openConfirm(
      "Desactivar producto",
      `¿Desactivar "${product.name}"? Seguirá en el historial pero no estará disponible para la venta.`,
      async () => {
        closeConfirm()
        try {
          const res = await fetch(`${API_BASE}/product/${product.id}/deactivate`, { method: "PATCH", headers: authHeaders })
          if (!res.ok) throw new Error("Error al desactivar")
          setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, isActive: false } : p))
        } catch (err: any) {
          openConfirm("Error", err.message, closeConfirm)
        }
      }
    )
  }

  const handleActivate = async (product: ProductWithRelations) => {
    setOpenDropdown(null)
    try {
      const res = await fetch(`${API_BASE}/product/${product.id}/activate`, { method: "PATCH", headers: authHeaders })
      if (!res.ok) throw new Error("Error al activar")
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, isActive: true } : p))
    } catch (err: any) {
      openConfirm("Error", err.message, closeConfirm)
    }
  }

  const parseFormNumber = (value: string, fallback = 0) => {
    if (!value.trim()) return fallback
    return Number.parseFloat(value)
  }

  const validateStockField = (value: number, label: string, unitType: UnitType) => {
    if (!Number.isFinite(value)) return `${label} debe ser un número válido`
    if (value < 0) return `${label} no puede ser negativo`
    if (isUnitType(unitType) && !Number.isInteger(value)) {
      return `${label} debe ser entero cuando la unidad de medida es "Unidad"`
    }
    return null
  }

  const validateForm = () => {
    const errors: ProductFormErrors = {}
    const name = formData.name.trim()
    if (name.length < 2) {
      errors.name = "El nombre debe tener al menos 2 caracteres"
    }

    if (!formData.categoryId) {
      errors.categoryId = "Seleccioná una categoría"
    }

    const price = parseFormNumber(formData.price, Number.NaN)
    if (!Number.isFinite(price) || price < 0) {
      errors.price = "El precio de venta debe ser un número válido"
    }

    const cost = parseFormNumber(formData.cost)
    if (!Number.isFinite(cost) || cost < 0) {
      errors.cost = "El precio de costo debe ser un número válido"
    }

    const stock = parseFormNumber(formData.stock, Number.NaN)
    const stockError = validateStockField(stock, "El stock actual", formData.unitType)
    if (stockError) errors.stock = stockError

    const stockMinimum = parseFormNumber(formData.stockMinimum)
    const stockMinimumError = validateStockField(stockMinimum, "El stock mínimo", formData.unitType)
    if (stockMinimumError) errors.stockMinimum = stockMinimumError

    if (errors.name) nameRef.current?.focus()
    else if (errors.categoryId) categoryRef.current?.focus()
    else if (errors.price) priceRef.current?.focus()
    else if (errors.cost) costRef.current?.focus()
    else if (errors.stock) stockRef.current?.focus()
    else if (errors.stockMinimum) stockMinRef.current?.focus()

    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validateForm()
    setFieldErrors(errors)
    setSubmitError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    setSubmitError(null)
    const stock = parseFormNumber(formData.stock)
    const stockMinimum = parseFormNumber(formData.stockMinimum)
    const payload = {
      name: formData.name.trim(),
      barcode: formData.barcode || undefined,
      categoryId: formData.categoryId,
      subcategoryId: formData.subcategoryId || undefined,
      price: Number.parseFloat(formData.price),
      cost: formData.cost ? Number.parseFloat(formData.cost) : undefined,
      wholesalePrice: formData.wholesalePrice ? Number.parseFloat(formData.wholesalePrice) : 0,
      stock,
      unitType: formData.unitType,
      stockMinimum,
      imageUrl: formData.imageUrl || undefined,
      stockNotes: formData.stockNotes || undefined,
      supplierId: formData.supplierId || null,
    }
    try {
      if (editingProduct) {
        const res = await fetch(`${API_BASE}/product/${editingProduct.id}`, {
          method: "PATCH", headers: authHeaders, body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.message ?? "Error al actualizar")
        }
        const updated: ProductWithRelations = await res.json()
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      } else {
        const res = await fetch(`${API_BASE}/product`, {
          method: "POST", headers: authHeaders, body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.message ?? "Error al crear")
        }
        const created: ProductWithRelations = await res.json()
        setProducts((prev) => [created, ...prev])
      }
      setIsDialogOpen(false)
      resetForm()
    } catch (err: any) {
      const message = err instanceof Error ? err.message : "Error al guardar el producto"
      if (/barcode|c[oó]digo de barras/i.test(message)) {
        setFieldErrors((previous) => ({ ...previous, barcode: message }))
        barcodeRef.current?.focus()
      } else {
        setSubmitError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true)
    setSubmitError(null)
    const uploadData = new FormData()
    uploadData.append("file", file)
    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: uploadData,
      })
      if (!res.ok) throw new Error("Error al subir la imagen")
      const data = await res.json()
      setFormData((prev) => ({ ...prev, imageUrl: data.url }))
    } catch (err: any) {
      setSubmitError(err instanceof Error ? err.message : "Error al subir la imagen")
    } finally {
      setUploadingImage(false)
    }
  }

  const calcMargin = (price: string, cost: string) => {
    const p = Number.parseFloat(price)
    const c = Number.parseFloat(cost)
    if (!Number.isFinite(p) || !Number.isFinite(c) || c <= 0) return ""
    return (((p / c) - 1) * 100).toFixed(2)
  }

  const applyMarginToPrice = (margin: string, cost: string) => {
    const m = Number.parseFloat(margin)
    const c = Number.parseFloat(cost)
    if (!Number.isFinite(m) || !Number.isFinite(c) || c <= 0) return ""
    return (c * (1 + m / 100)).toFixed(0)
  }

  const isLowStock = (p: ProductWithRelations) => p.stock <= p.stockMinimum
  const stockAdjustmentNoteVisible = Boolean(
    editingProduct && parseFormNumber(formData.stock) !== editingProduct.stock
  )
  const focusedProduct = focusedDetails
    ? products.find((product) => product.id === focusedDetails.productId) ?? null
    : null

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const detailsTooltip = focusedDetails
        ? document.getElementById(`product-details-${focusedDetails.productId}`)
        : null
      if (detailsTooltip?.contains(target)) return

      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
        setDropdownPos(null)
      }
      if (focusedDetails) setFocusedDetails(null)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [focusedDetails])

  useEffect(() => {
    if (!openDropdown && !focusedDetails) return
    const close = (event: Event) => {
      const detailsTooltip = focusedDetails
        ? document.getElementById(`product-details-${focusedDetails.productId}`)
        : null
      if (event.target instanceof Node && detailsTooltip?.contains(event.target)) return

      setOpenDropdown(null)
      setDropdownPos(null)
      setFocusedDetails(null)
    }
    window.addEventListener("scroll", close, true)
    return () => window.removeEventListener("scroll", close, true)
  }, [openDropdown, focusedDetails])

  return (
    <div className={styles.page}>
      <Header title="Productos" />

      <div className={styles.container}>
        <div className={`${styles.actionsBar} ${dataTableStyles.fixedRegion}`}>
          <div className={styles.searchWrapper}>
            {hasCompletedProductLoad && (loading || isSearchPending)
              ? <Loader2 size={16} className={`${styles.searchIcon} ${styles.spinner}`} aria-hidden="true" />
              : <Search size={16} className={styles.searchIcon} />}
            <input
              placeholder="Buscar por nombre, código o SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button className={styles.newButton} onClick={() => { resetForm(); setIsDialogOpen(true) }}>
            <Plus size={16} /> Nuevo producto
          </button>
        </div>

        <div className={`${styles.tableCard} ${styles.productsCard} ${dataTableStyles.flexColumn}`}>
          <div className={dataTableStyles.viewport} aria-busy={loading || isSearchPending}>
            <table className={`${styles.table} ${styles.productsTable} ${dataTableStyles.naturalRows} ${dataTableStyles.compactCells}`}>
              <thead className={styles.tableHeader}>
                <tr>
                  <th className={styles.tableHeaderCell}>Producto</th>
                  <th className={styles.tableHeaderCell}>SKU / Código</th>
                  <th className={styles.tableHeaderCell}>Categoría</th>
                  <th className={styles.tableHeaderCell}>Unidad</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Costo</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Precio público</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Precio mayorista</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Stock</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(loading || isSearchPending) && products.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className={styles.loadingState} role="status" aria-live="polite">
                        <Loader2 size={24} className={styles.spinner} />
                        <p>
                          {isSearchPending
                            ? "Buscando productos…"
                            : hasCompletedProductLoad ? "Actualizando productos…" : "Cargando productos…"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : error && products.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className={styles.emptyState}>
                        <AlertCircle size={32} className={styles.emptyStateIcon} />
                        <p className={styles.emptyStateTitle}>{error}</p>
                        <button className={styles.newButton} onClick={() => setReloadVersion((version) => version + 1)}>
                          Reintentar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className={styles.emptyState}>
                        <Package size={32} className={styles.emptyStateIcon} />
                        <p>No se encontraron productos</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {error && (
                      <tr>
                        <td colSpan={9}>
                          <div className={styles.emptyState} role="alert">
                            <AlertCircle size={18} className={styles.emptyStateIcon} />
                            <span>{error}</span>
                            <button className={styles.newButton} onClick={() => setReloadVersion((version) => version + 1)}>
                              Reintentar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {products.map((product) => (
                    <tr key={product.id} className={`${styles.tableRow} ${!product.isActive ? styles.tableRowInactive : ""}`}>
                      <td className={styles.tableCell}>
                        <div className={styles.productCell}>
                          <div className={styles.productImageWrapper}>
                            {product.imageUrl
                              ? <img src={product.imageUrl} alt={product.name} className={styles.productImage} />
                              : <div className={styles.productImagePlaceholder}><Package size={22} /></div>
                            }
                            {isLowStock(product) && (
                              <span className={styles.stockBadgeOverlay} title="Stock bajo">
                                <AlertTriangle size={10} />
                              </span>
                            )}
                          </div>
                          <div className={styles.productInfo}>
                            <span className={styles.productName} title={product.name}>{product.name}</span>
                            <div className={styles.productMeta}>
                              {!product.isActive && (
                                <span className={`${styles.badge} ${styles.badgeInactive}`}>
                                  <EyeOff size={10} /> Inactivo
                                </span>
                              )}
                              {isLowStock(product) && (
                                <span className={`${styles.badge} ${styles.badgeWarning}`}>
                                  <AlertTriangle size={10} /> Stock bajo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={styles.tableCell}>
                        <div className={styles.codeStack}>
                          {product.sku && <span className={styles.skuChip} title={product.sku}><Tag size={10} />{product.sku}</span>}
                          {product.barcode && <span className={styles.monoText} title={product.barcode}>{product.barcode}</span>}
                          {!product.sku && !product.barcode && <span className={styles.mutedText}>—</span>}
                        </div>
                      </td>
                      <td className={styles.tableCell}>
                        <div className={styles.categoryStack}>
                          <span title={product.category?.name ?? "—"}>{product.category?.name ?? "—"}</span>
                          {product.subcategory && <span className={styles.subcategoryText} title={product.subcategory.name}>{product.subcategory.name}</span>}
                          {product.supplier && <span className={styles.supplierText} title={product.supplier.name}>{product.supplier.name}</span>}
                        </div>
                      </td>
                      <td className={styles.tableCell}>
                        <span className={styles.unitPill}>
                          {UNIT_LABELS[product.unitType ?? "UNIT"]}
                        </span>
                      </td>
                      <td className={`${styles.tableCell} ${styles.tableCellRight}`}>
                        <span className={styles.costText}>{product.cost != null ? formatCurrency(product.cost) : "—"}</span>
                      </td>
                      <td className={`${styles.tableCell} ${styles.tableCellRight} ${styles.priceText}`}>
                        {formatCurrency(product.price)}
                      </td>
                      <td className={`${styles.tableCell} ${styles.tableCellRight} ${styles.priceText}`}>
                        {product.wholesalePrice != null ? formatCurrency(product.wholesalePrice) : "—"}
                      </td>
                      <td className={`${styles.tableCell} ${styles.tableCellRight}`}>
                        <div
                          className={styles.stockCell}
                          title={`Stock actual: ${formatStock(product.stock, product.unitType ?? "UNIT")}${product.stockMinimum > 0 ? ` · Stock mínimo: ${formatStock(product.stockMinimum, product.unitType ?? "UNIT")}` : ""}`}
                        >
                          <span className={isLowStock(product) ? styles.stockWarning : styles.stockOk}>
                            {formatStock(product.stock, product.unitType ?? "UNIT")}
                          </span>
                          {product.stockMinimum > 0 && (
                            <span className={styles.stockMin}>
                              mín {formatStock(product.stockMinimum, product.unitType ?? "UNIT")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${styles.tableCell} ${styles.tableCellRight}`}>
                        <div className={styles.dropdown}>
                          <button
                            className={styles.actionButton}
                            onClick={(e) => toggleDropdown(product.id, e)}
                            onFocus={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setFocusedDetails({
                                productId: product.id,
                                top: Math.max(16, Math.min(rect.top, window.innerHeight - 480)),
                                left: Math.max(16, Math.min(rect.left, window.innerWidth - 400)),
                              })
                            }}
                            onBlur={() => setFocusedDetails(null)}
                            aria-label={`Más acciones para ${product.name}`}
                            aria-describedby={focusedDetails?.productId === product.id ? `product-details-${product.id}` : undefined}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </div>
                        {openDropdown === product.id && dropdownPos && createPortal(
                          <div
                            className={styles.dropdownMenu}
                            style={{ top: dropdownPos.top, left: dropdownPos.left }}
                            ref={dropdownRef}
                          >
                            <button className={styles.dropdownItem} onClick={() => handleEdit(product)}>
                              <Pencil size={14} /> Editar
                            </button>
                            {product.isActive ? (
                              <button className={styles.dropdownItem} onClick={() => handleDeactivate(product)}>
                                <EyeOff size={14} /> Desactivar
                              </button>
                            ) : (
                              <button className={styles.dropdownItem} onClick={() => handleActivate(product)}>
                                <Eye size={14} /> Activar
                              </button>
                            )}
                            <div className={styles.dropdownDivider} />
                            <button
                              className={`${styles.dropdownItem} ${styles.dropdownItemDestructive}`}
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          </div>,
                          document.body
                        )}
                      </td>
                    </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
          {total > PRODUCTS_PAGE_SIZE && (
            <div className={`${styles.pagination} ${dataTableStyles.fixedRegion}`}>
              <button
                className={styles.pageBtn}
                disabled={loading || isSearchPending || currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                ← Anterior
              </button>
              <span className={styles.pageInfo} role="status" aria-live="polite">
                {(loading || isSearchPending) && <Loader2 size={14} className={styles.spinner} aria-hidden="true" />}
                Página {currentPage} de {totalPages} · {total} productos
                {(loading || isSearchPending) && " · Actualizando…"}
              </span>
              <button
                className={styles.pageBtn}
                disabled={loading || isSearchPending || currentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
        {focusedDetails && focusedProduct && createPortal(
            <div
              id={`product-details-${focusedProduct.id}`}
              className={styles.productDetailsTooltip}
              role="tooltip"
              style={{ top: focusedDetails.top, left: focusedDetails.left }}
            >
              <strong className={styles.productDetailsName}>{focusedProduct.name}</strong>
              <dl className={styles.productDetailsList}>
                <div><dt>SKU</dt><dd>{focusedProduct.sku || "—"}</dd></div>
                <div><dt>Código de barras</dt><dd>{focusedProduct.barcode || "—"}</dd></div>
                <div><dt>Categoría</dt><dd>{focusedProduct.category?.name ?? "—"}</dd></div>
                {focusedProduct.subcategory && <div><dt>Subcategoría</dt><dd>{focusedProduct.subcategory.name}</dd></div>}
                {focusedProduct.supplier && <div><dt>Proveedor</dt><dd>{focusedProduct.supplier.name}</dd></div>}
                <div><dt>Unidad</dt><dd>{UNIT_LABELS[focusedProduct.unitType ?? "UNIT"]}</dd></div>
                <div><dt>Costo</dt><dd>{focusedProduct.cost != null ? formatCurrency(focusedProduct.cost) : "—"}</dd></div>
                <div><dt>Precio público</dt><dd>{formatCurrency(focusedProduct.price)}</dd></div>
                <div><dt>Precio mayorista</dt><dd>{focusedProduct.wholesalePrice != null ? formatCurrency(focusedProduct.wholesalePrice) : "—"}</dd></div>
                <div><dt>Stock actual</dt><dd>{formatStock(focusedProduct.stock, focusedProduct.unitType ?? "UNIT")}</dd></div>
                <div><dt>Stock mínimo</dt><dd>{formatStock(focusedProduct.stockMinimum, focusedProduct.unitType ?? "UNIT")}</dd></div>
              </dl>
            </div>,
            document.body
          )}
      </div>

      {/* ── Modal producto ───────────────────────────────────────────────────── */}
      {isDialogOpen && (
        <div className={styles.modalOverlay} onClick={() => { setIsDialogOpen(false); resetForm() }}>
          <div data-pos-modal className={styles.productModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.productModalHeader}>
              <h2 className={styles.modalTitle}>{editingProduct ? "Editar producto" : "Nuevo producto"}</h2>
              <p className={styles.modalDescription}>
                {editingProduct ? "Modificá los datos del producto" : "Completá los datos — usá Enter para avanzar entre campos"}
              </p>
            </div>
            <form className={styles.productModalForm} onSubmit={handleSubmit} noValidate>
              <div className={styles.productModalContent}>
                <div
                  className={`${styles.productErrorNotice} ${submitError ? styles.productErrorNoticeVisible : ""}`}
                  role={submitError ? "alert" : undefined}
                  aria-live={submitError ? "assertive" : undefined}
                  title={submitError ?? undefined}
                >
                  {submitError && <><AlertCircle size={14} /><span>{submitError}</span></>}
                </div>
                <div className={styles.productFormLayout}>
                  <section className={styles.productFormSection} aria-labelledby="product-data-title">
                    <h3 id="product-data-title" className={styles.productSectionTitle}>Datos del producto</h3>
                    <p className={styles.imageUploadHint}>Podés subir, arrastrar o pegar una imagen (Ctrl+V). JPG, PNG o WebP · Máx. 5 MB.</p>

                    <div className={styles.productIdentity}>
                      <div className={styles.productImageField}>
                        <span className={styles.label}>Imagen</span>
                        <ImageDropPasteArea
                          className={styles.compactImageDropArea}
                          onImage={handleImageUpload}
                          onValidationError={setSubmitError}
                          disabled={uploadingImage}
                        >
                          {formData.imageUrl ? (
                            <div className={`${styles.imagePreviewWrapper} ${styles.compactImagePreview}`}>
                              <img src={formData.imageUrl} alt="Vista previa del producto" className={styles.imagePreview} />
                              <button type="button" className={styles.removeImageBtn} onClick={() => setFormData({ ...formData, imageUrl: "" })} aria-label="Quitar imagen">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : (
                            <label className={`${styles.uploadArea} ${styles.compactUploadArea}`}>
                              <input type="file" accept="image/png, image/jpeg, image/webp" className={styles.hiddenInput} disabled={uploadingImage} />
                              <div className={`${styles.uploadContent} ${styles.compactUploadContent}`}>
                                {uploadingImage
                                  ? <><Loader2 size={20} className={styles.spinner} /><span>Subiendo…</span></>
                                  : <><UploadCloud size={20} /><span>Elegir</span></>
                                }
                              </div>
                            </label>
                          )}
                        </ImageDropPasteArea>
                      </div>

                      <div className={styles.productIdentityFields}>
                        <div className={`${styles.formGroup} ${styles.productCompactGroup}`}>
                          <label className={styles.label} htmlFor="product-name-input">Nombre *</label>
                          <input id="product-name-input" ref={nameRef} className={`${styles.input} ${fieldErrors.name ? styles.fieldInvalid : ""}`} value={formData.name}
                            aria-invalid={Boolean(fieldErrors.name)}
                            aria-describedby={fieldErrors.name ? "product-name-error" : undefined}
                            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clearFieldError("name") }}
                            onKeyDown={(e) => handleEnterKey(e, barcodeRef)}
                            placeholder="Ej: Cadena 428H x 120 eslabones" required />
                          <span id="product-name-error" className={`${styles.fieldErrorSlot} ${fieldErrors.name ? styles.fieldErrorVisible : ""}`} role={fieldErrors.name ? "alert" : undefined} title={fieldErrors.name ?? undefined}>
                            {fieldErrors.name ?? " "}
                          </span>
                        </div>
                        <div className={`${styles.formGroup} ${styles.productCompactGroup}`}>
                          <label className={styles.label} htmlFor="product-barcode-input">Código de barras</label>
                          <input id="product-barcode-input" ref={barcodeRef} className={`${styles.input} ${fieldErrors.barcode ? styles.fieldInvalid : ""}`} value={formData.barcode}
                            aria-invalid={Boolean(fieldErrors.barcode)}
                            aria-describedby={fieldErrors.barcode ? "product-barcode-error" : undefined}
                            onChange={(e) => { setFormData({ ...formData, barcode: e.target.value }); clearFieldError("barcode") }}
                            onKeyDown={(e) => handleEnterKey(e, categoryRef)}
                            placeholder="7790000000000" />
                          <span className={styles.fieldHint}>El SKU se genera automáticamente</span>
                          <span id="product-barcode-error" className={`${styles.fieldErrorSlot} ${fieldErrors.barcode ? styles.fieldErrorVisible : ""}`} role={fieldErrors.barcode ? "alert" : undefined} title={fieldErrors.barcode ?? undefined}>
                            {fieldErrors.barcode ?? " "}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={`${styles.productFormRow} ${styles.productCategoryRow}`}>
                      <div className={`${styles.formGroup} ${styles.productCompactGroup}`}>
                        <label className={styles.label} htmlFor="product-category-input">Categoría *</label>
                        <select id="product-category-input" ref={categoryRef} className={`${styles.select} ${fieldErrors.categoryId ? styles.fieldInvalid : ""}`} value={formData.categoryId}
                          aria-invalid={Boolean(fieldErrors.categoryId)}
                          aria-describedby={fieldErrors.categoryId ? "product-category-error" : undefined}
                          onChange={(e) => { setFormData({ ...formData, categoryId: e.target.value, subcategoryId: "" }); clearFieldError("categoryId") }}
                          onKeyDown={(e) => handleEnterKey(e, subcategoryRef, supplierRef)} required>
                          <option value="">Seleccionar</option>
                          {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                        <span id="product-category-error" className={`${styles.fieldErrorSlot} ${fieldErrors.categoryId ? styles.fieldErrorVisible : ""}`} role={fieldErrors.categoryId ? "alert" : undefined} title={fieldErrors.categoryId ?? undefined}>
                          {fieldErrors.categoryId ?? " "}
                        </span>
                      </div>
                      <div className={`${styles.formGroup} ${styles.productCompactGroup}`}>
                        <label className={styles.label}>Subcategoría</label>
                        <select ref={subcategoryRef} className={styles.select} value={formData.subcategoryId}
                          onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                          onKeyDown={(e) => handleEnterKey(e, supplierRef)}
                          disabled={!formData.categoryId || subcategories.length === 0}>
                          <option value="">Seleccionar</option>
                          {subcategories.map((sub: any) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className={`${styles.formGroup} ${styles.productCompactGroup}`}>
                      <label className={styles.label}>Proveedor</label>
                      <select ref={supplierRef} className={styles.select} value={formData.supplierId}
                        onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                        onKeyDown={(e) => handleEnterKey(e, costRef)}>
                        <option value="">Ninguno (opcional)</option>
                        {suppliers.map((sup: any) => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                      </select>
                    </div>
                  </section>

                  <section className={styles.productFormSection} aria-labelledby="product-pricing-title">
                    <h3 id="product-pricing-title" className={styles.productSectionTitle}>Precios e inventario</h3>
                    <div className={`${styles.formGroup} ${styles.productCompactGroup}`}>
                      <label className={styles.label}>Precio de costo</label>
                      <input
                        ref={costRef}
                        className={`${styles.input} ${fieldErrors.cost ? styles.fieldInvalid : ""}`}
                        aria-invalid={Boolean(fieldErrors.cost)}
                        aria-describedby={fieldErrors.cost ? "product-cost-error" : undefined}
                        type="text"
                        inputMode="numeric"
                        value={formData.cost}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "")
                          handleCostChange(val)
                          clearFieldError("cost")
                          clearFieldError("price")
                        }}
                        onKeyDown={(e) => handleEnterKey(e, publicMarginRef)}
                        placeholder="0"
                      />
                      <span id="product-cost-error" className={`${styles.fieldErrorSlot} ${fieldErrors.cost ? styles.fieldErrorVisible : ""}`} role={fieldErrors.cost ? "alert" : undefined} title={fieldErrors.cost ?? undefined}>
                        {fieldErrors.cost ?? " "}
                      </span>
                    </div>

                    <div className={styles.pricingCard}>
                      <div className={styles.pricingCardTitle}>Precios de venta</div>
                      <div className={styles.pricingRow}>
                        <div className={styles.pricingControl}>
                          <label className={styles.pricingSubLabel} htmlFor="publicMargin">Ganancia público (%)</label>
                          <div className={styles.pricingField}>
                            <span className={styles.pricingFieldHint}>%</span>
                            <input
                              id="publicMargin"
                              ref={publicMarginRef}
                              className={`${styles.pricingInput} ${fieldErrors.price ? styles.fieldInvalid : ""}`}
                              aria-invalid={Boolean(fieldErrors.price)}
                              aria-describedby={fieldErrors.price ? "product-price-error" : undefined}
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={publicMargin}
                              onChange={(e) => handlePublicMarginChange(e.target.value)}
                              onKeyDown={(e) => handleEnterKey(e, priceRef)}
                            />
                          </div>
                        </div>
                        <div className={styles.pricingControl}>
                          <label className={styles.pricingSubLabel} htmlFor="publicPrice">Precio público *</label>
                          <div className={styles.pricingField}>
                            <span className={styles.pricingFieldHint}>Gs.</span>
                            <input
                              id="publicPrice"
                              ref={priceRef}
                              className={styles.pricingInput}
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={formData.price}
                              onChange={(e) => { handlePublicPriceChange(e.target.value.replace(/[^0-9]/g, "")); clearFieldError("price") }}
                              onKeyDown={(e) => handleEnterKey(e, wholesaleMarginRef)}
                              required
                            />
                          </div>
                          <span id="product-price-error" className={`${styles.fieldErrorSlot} ${fieldErrors.price ? styles.fieldErrorVisible : ""}`} role={fieldErrors.price ? "alert" : undefined} title={fieldErrors.price ?? undefined}>
                            {fieldErrors.price ?? " "}
                          </span>
                        </div>
                      </div>

                      <div className={styles.pricingRow}>
                        <div className={styles.pricingControl}>
                          <label className={styles.pricingSubLabel} htmlFor="wholesaleMargin">Ganancia mayorista (%)</label>
                          <div className={styles.pricingField}>
                            <span className={styles.pricingFieldHint}>%</span>
                            <input
                              id="wholesaleMargin"
                              ref={wholesaleMarginRef}
                              className={styles.pricingInput}
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={wholesaleMargin}
                              onChange={(e) => handleWholesaleMarginChange(e.target.value)}
                              onKeyDown={(e) => handleEnterKey(e, wholesalePriceRef)}
                            />
                          </div>
                        </div>
                        <div className={styles.pricingControl}>
                          <label className={styles.pricingSubLabel} htmlFor="wholesalePrice">Precio mayorista</label>
                          <div className={styles.pricingField}>
                            <span className={styles.pricingFieldHint}>Gs.</span>
                            <input
                              id="wholesalePrice"
                              ref={wholesalePriceRef}
                              className={styles.pricingInput}
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={formData.wholesalePrice}
                              onChange={(e) => handleWholesalePriceChange(e.target.value.replace(/[^0-9]/g, ""))}
                              onKeyDown={(e) => handleEnterKey(e, unitTypeRef)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`${styles.formGroup} ${styles.productCompactGroup}`}>
                      <label className={styles.label}>Unidad de medida *</label>
                      <select
                        ref={unitTypeRef}
                        className={styles.select}
                        value={formData.unitType}
                        onChange={(e) => {
                          setFormData({ ...formData, unitType: e.target.value as UnitType })
                          clearFieldError("stock")
                          clearFieldError("stockMinimum")
                        }}
                        onKeyDown={(e) => handleEnterKey(e, stockRef)}
                      >
                        {UNIT_OPTIONS.map((unit) => (
                          <option key={unit.value} value={unit.value}>{unit.label}</option>
                        ))}
                      </select>
                      <span className={styles.fieldHint}>
                        {UNIT_OPTIONS.find((unit) => unit.value === formData.unitType)?.hint}
                      </span>
                    </div>

                    <div className={styles.productFormRow}>
                      <div className={`${styles.formGroup} ${styles.productCompactGroup}`}>
                        <label className={styles.label} htmlFor="product-stock-input">Stock actual *</label>
                        <input id="product-stock-input" ref={stockRef} className={`${styles.input} ${fieldErrors.stock ? styles.fieldInvalid : ""}`} type="number" value={formData.stock}
                          aria-invalid={Boolean(fieldErrors.stock)}
                          aria-describedby={fieldErrors.stock ? "product-stock-error" : undefined}
                          onChange={(e) => { setFormData({ ...formData, stock: e.target.value }); clearFieldError("stock") }}
                          onKeyDown={(e) => handleEnterKey(e, stockMinRef)}
                          placeholder={isUnitType(formData.unitType) ? "0" : "0.000"}
                          min="0"
                          step={isUnitType(formData.unitType) ? "1" : "0.001"}
                          required />
                        <span id="product-stock-error" className={`${styles.fieldErrorSlot} ${fieldErrors.stock ? styles.fieldErrorVisible : ""}`} role={fieldErrors.stock ? "alert" : undefined} title={fieldErrors.stock ?? undefined}>
                          {fieldErrors.stock ?? " "}
                        </span>
                      </div>
                      <div className={`${styles.formGroup} ${styles.productCompactGroup}`}>
                        <label className={styles.label} htmlFor="product-stock-minimum-input">Stock mínimo</label>
                        <input id="product-stock-minimum-input" ref={stockMinRef} className={`${styles.input} ${fieldErrors.stockMinimum ? styles.fieldInvalid : ""}`} type="number" value={formData.stockMinimum}
                          aria-invalid={Boolean(fieldErrors.stockMinimum)}
                          aria-describedby={fieldErrors.stockMinimum ? "product-stock-minimum-error" : undefined}
                          onChange={(e) => { setFormData({ ...formData, stockMinimum: e.target.value }); clearFieldError("stockMinimum") }}
                          onKeyDown={(e) => handleEnterKey(e, stockAdjustmentNoteVisible ? stockNotesRef : submitRef)}
                          placeholder={isUnitType(formData.unitType) ? "0" : "0.000"}
                          min="0"
                          step={isUnitType(formData.unitType) ? "1" : "0.001"} />
                        <span className={styles.fieldHint}>Alerta de reposición</span>
                        <span id="product-stock-minimum-error" className={`${styles.fieldErrorSlot} ${fieldErrors.stockMinimum ? styles.fieldErrorVisible : ""}`} role={fieldErrors.stockMinimum ? "alert" : undefined} title={fieldErrors.stockMinimum ?? undefined}>
                          {fieldErrors.stockMinimum ?? " "}
                        </span>
                      </div>
                    </div>

                    {/* El motivo aparece únicamente al cambiar el stock durante la edición. */}
                    {stockAdjustmentNoteVisible && editingProduct && (
                      <div className={`${styles.formGroup} ${styles.productCompactGroup}`}>
                        <label className={styles.label}>Motivo del ajuste de stock</label>
                        <input
                          ref={stockNotesRef}
                          className={styles.input}
                          value={formData.stockNotes}
                          onChange={(e) => setFormData({ ...formData, stockNotes: e.target.value })}
                          onKeyDown={(e) => handleEnterKey(e, submitRef)}
                          placeholder="Ej: Conteo físico, merma, corrección de error…"
                          maxLength={300}
                        />
                        <span className={styles.fieldHint}>
                          Stock actual: {formatStock(editingProduct.stock, editingProduct.unitType ?? "UNIT")} → nuevo: {formatStock(parseFormNumber(formData.stock), formData.unitType)}
                        </span>
                      </div>
                    )}
                  </section>
                </div>
              </div>
              <div className={styles.productModalFooter}>
                <button type="button" className={styles.cancelButton} onClick={() => { setIsDialogOpen(false); resetForm() }} disabled={submitting}>
                  Cancelar
                </button>
                <button ref={submitRef} type="submit" className={styles.submitButton} disabled={submitting}>
                  {submitting && <Loader2 size={14} className={styles.spinner} />}
                  {editingProduct ? "Guardar cambios" : "Crear producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm dialog ───────────────────────────────────────────────────── */}
      {confirm.open && (
        <div className={styles.confirmOverlay} onClick={closeConfirm}>
          <div data-pos-modal className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <AlertTriangle size={22} />
            </div>
            <div className={styles.confirmBody}>
              <h3 className={styles.confirmTitle}>{confirm.title}</h3>
              <p className={styles.confirmDescription}>{confirm.description}</p>
            </div>
            <div className={styles.confirmFooter}>
              <button className={styles.cancelButton} onClick={closeConfirm}>Cancelar</button>
              <button className={styles.confirmDestructiveButton} onClick={confirm.onConfirm}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
