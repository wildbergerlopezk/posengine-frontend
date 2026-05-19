"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Header } from "@/src/shared/components/Header"
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, Package,
  AlertTriangle, UploadCloud, Loader2, AlertCircle, Tag, EyeOff, Eye
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import type { Product, Category, UnitType } from "@/src/shared/types"
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

export function ProductsPage() {
  const { accessToken } = useAuthStore()
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 20
  const totalPages = Math.ceil(total / LIMIT)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithRelations | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false, title: "", description: "", onConfirm: () => { },
  })

  const openConfirm = (title: string, description: string, onConfirm: () => void) =>
    setConfirm({ open: true, title, description, onConfirm })

  const closeConfirm = () => setConfirm((prev) => ({ ...prev, open: false }))

  const [formData, setFormData] = useState({
    name: "", barcode: "", categoryId: "", subcategoryId: "",
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
  const costRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  const wholesalePriceRef = useRef<HTMLInputElement>(null)
  const publicMarginRef = useRef<HTMLInputElement>(null)
  const wholesaleMarginRef = useRef<HTMLInputElement>(null)
  const unitTypeRef = useRef<HTMLSelectElement>(null)
  const stockRef = useRef<HTMLInputElement>(null)
  const stockMinRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)

  const handleEnterKey = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLElement | null>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      setTimeout(() => nextRef.current?.focus(), 50)
    }
  }

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  const fetchProducts = useCallback(async (page = 1, search = searchQuery) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        page: String(page),
        ...(search.trim() && { search: search.trim() }),
      })
      const res = await fetch(`${API_BASE}/product?${params}`, { headers: authHeaders })
      if (!res.ok) throw new Error("Error al cargar productos")
      const data = await res.json()
      setProducts(data.items ?? data)
      setTotal(data.total ?? 0)
      setCurrentPage(page)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [accessToken, searchQuery])

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

  useEffect(() => {
    fetchProducts(1, searchQuery)
    fetchCategories()
  }, [fetchCategories]) // solo al montar

  // ── Búsqueda con debounce — agregá este useEffect ─────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(1, searchQuery)
    }, 350) // espera 350ms después de que el usuario deja de escribir
    return () => clearTimeout(timer)
  }, [searchQuery])

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
    if (!isNaN(c)) {
      const updates: Partial<typeof formData> = { cost: val }
      if (!isNaN(m)) {
        updates.price = String(Math.round(c * (1 + m / 100)))
      }
      if (!isNaN(wm)) {
        updates.wholesalePrice = String(Math.round(c * (1 + wm / 100)))
      }
      setFormData(prev => ({ ...prev, ...updates }))
    } else {
      setFormData(prev => ({ ...prev, cost: val }))
    }
  }

  const handlePublicMarginChange = (val: string) => {
    setPublicMargin(val)
    const c = parseFloat(formData.cost)
    const m = parseFloat(val)
    if (!isNaN(c) && !isNaN(m)) {
      setFormData(prev => ({ ...prev, price: String(Math.round(c * (1 + m / 100))) }))
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
      name: "", barcode: "", categoryId: "", subcategoryId: "",
      price: "", cost: "", wholesalePrice: "",
      stock: "", stockMinimum: "", imageUrl: "",
      unitType: "UNIT", stockNotes: "",
    })
    setPublicMargin("")
    setWholesaleMargin("")
    setEditingProduct(null)
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
      price: price.toString(),
      cost: cost.toString(),
      wholesalePrice: wholesale.toString(),
      stock: product.stock?.toString() || "0",
      unitType: product.unitType ?? "UNIT",
      stockMinimum: product.stockMinimum?.toString() || "0",
      imageUrl: product.imageUrl || "",
      stockNotes: "",
    })
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
    const name = formData.name.trim()
    if (name.length < 2) {
      nameRef.current?.focus()
      return "El nombre debe tener al menos 2 caracteres"
    }

    if (!formData.categoryId) {
      categoryRef.current?.focus()
      return "Seleccioná una categoría"
    }

    const price = parseFormNumber(formData.price, Number.NaN)
    if (!Number.isFinite(price) || price < 0) {
      priceRef.current?.focus()
      return "El precio de venta debe ser un número válido"
    }

    const cost = parseFormNumber(formData.cost)
    if (!Number.isFinite(cost) || cost < 0) {
      costRef.current?.focus()
      return "El precio de costo debe ser un número válido"
    }

    const stock = parseFormNumber(formData.stock, Number.NaN)
    const stockError = validateStockField(stock, "El stock actual", formData.unitType)
    if (stockError) {
      stockRef.current?.focus()
      return stockError
    }

    const stockMinimum = parseFormNumber(formData.stockMinimum)
    const stockMinimumError = validateStockField(stockMinimum, "El stock mínimo", formData.unitType)
    if (stockMinimumError) {
      stockMinRef.current?.focus()
      return stockMinimumError
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const formError = validateForm()
    if (formError) {
      setSubmitError(formError)
      return
    }

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
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
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
      openConfirm("Error al subir imagen", err.message, closeConfirm)
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node))
        setOpenDropdown(null)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className={styles.page}>
      <Header title="Productos" />

      <div className={styles.container}>
        <div className={styles.actionsBar}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
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

        <div className={styles.tableCard}>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 size={32} className={styles.spinner} />
              <p>Cargando productos…</p>
            </div>
          ) : error ? (
            <div className={styles.emptyState}>
              <AlertCircle size={48} className={styles.emptyStateIcon} />
              <p className={styles.emptyStateTitle}>{error}</p>
              <button className={styles.newButton} onClick={() => fetchProducts()}>Reintentar</button>
            </div>
          ) : (
            <table className={styles.table}>
              <thead className={styles.tableHeader}>
                <tr>
                  <th className={styles.tableHeaderCell}>Producto</th>
                  <th className={styles.tableHeaderCell}>SKU / Código</th>
                  <th className={styles.tableHeaderCell}>Categoría</th>
                  <th className={styles.tableHeaderCell}>Unidad</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Costo</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Precio</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Stock</th>
                  <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className={styles.emptyState}>
                        <Package size={32} className={styles.emptyStateIcon} />
                        <p>No se encontraron productos</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
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
                            <span className={styles.productName}>{product.name}</span>
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
                          {product.sku && <span className={styles.skuChip}><Tag size={10} />{product.sku}</span>}
                          {product.barcode && <span className={styles.monoText}>{product.barcode}</span>}
                          {!product.sku && !product.barcode && <span className={styles.mutedText}>—</span>}
                        </div>
                      </td>
                      <td className={styles.tableCell}>
                        <div className={styles.categoryStack}>
                          <span>{product.category?.name ?? "—"}</span>
                          {product.subcategory && <span className={styles.subcategoryText}>{product.subcategory.name}</span>}
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
                      <td className={`${styles.tableCell} ${styles.tableCellRight}`}>
                        <div className={styles.stockCell}>
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
                        <div className={styles.dropdown} ref={openDropdown === product.id ? dropdownRef : null}>
                          <button
                            className={styles.actionButton}
                            onClick={() => setOpenDropdown(openDropdown === product.id ? null : product.id)}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openDropdown === product.id && (
                            <div className={styles.dropdownMenu}>
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
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
          {total > LIMIT && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={currentPage === 1}
                onClick={() => fetchProducts(currentPage - 1)}
              >
                ← Anterior
              </button>
              <span className={styles.pageInfo}>
                Página {currentPage} de {totalPages} · {total} productos
              </span>
              <button
                className={styles.pageBtn}
                disabled={currentPage >= totalPages}
                onClick={() => fetchProducts(currentPage + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal producto ───────────────────────────────────────────────────── */}
      {isDialogOpen && (
        <div className={styles.modalOverlay} onClick={() => { setIsDialogOpen(false); resetForm() }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingProduct ? "Editar producto" : "Nuevo producto"}</h2>
              <p className={styles.modalDescription}>
                {editingProduct ? "Modificá los datos del producto" : "Completá los datos — usá Enter para avanzar entre campos"}
              </p>
            </div>
            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.modalContent}>
                {submitError && (
                  <div className={styles.errorBanner}>
                    <AlertCircle size={16} />{submitError}
                  </div>
                )}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Imagen del producto</label>
                  <div className={styles.imageUploadContainer}>
                    {formData.imageUrl ? (
                      <div className={styles.imagePreviewWrapper}>
                        <img src={formData.imageUrl} alt="Preview" className={styles.imagePreview} />
                        <button type="button" className={styles.removeImageBtn} onClick={() => setFormData({ ...formData, imageUrl: "" })}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className={styles.uploadArea}>
                        <input type="file" accept="image/png, image/jpeg, image/webp" className={styles.hiddenInput} onChange={handleImageUpload} disabled={uploadingImage} />
                        <div className={styles.uploadContent}>
                          {uploadingImage
                            ? <><Loader2 size={24} className={styles.spinner} /><span>Subiendo...</span></>
                            : <><UploadCloud size={24} /><span>Clic para subir imagen</span></>
                          }
                        </div>
                      </label>
                    )}
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Nombre *</label>
                  <input ref={nameRef} className={styles.input} value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    onKeyDown={(e) => handleEnterKey(e, barcodeRef)}
                    placeholder="Ej: Cadena 428H x 120 eslabones" required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Código de barras</label>
                  <input ref={barcodeRef} className={styles.input} value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    onKeyDown={(e) => handleEnterKey(e, categoryRef)}
                    placeholder="7790000000000" />
                  <span className={styles.fieldHint}>El SKU se genera automáticamente</span>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Categoría *</label>
                    <select ref={categoryRef} className={styles.select} value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subcategoryId: "" })}
                      onKeyDown={(e) => handleEnterKey(e, subcategoryRef)} required>
                      <option value="">Seleccionar</option>
                      {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Subcategoría</label>
                    <select ref={subcategoryRef} className={styles.select} value={formData.subcategoryId}
                      onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                      onKeyDown={(e) => handleEnterKey(e, costRef)}
                      disabled={!formData.categoryId || subcategories.length === 0}>
                      <option value="">Seleccionar</option>
                      {subcategories.map((sub: any) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Precio de costo</label>
                  <input
                    ref={costRef}
                    className={styles.input}
                    type="text"
                    inputMode="numeric"
                    value={formData.cost}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "")
                      setFormData({ ...formData, cost: val })
                    }}
                    onKeyDown={(e) => handleEnterKey(e, publicMarginRef)}
                    placeholder="0"
                  />
                </div>

                <div className={styles.pricingCard}>
                  <div className={styles.pricingCardTitle}>Precios de venta</div>

                  <div className={styles.pricingRow}>
                    <span className={styles.pricingLabel}>Precio público</span>
                    <div className={styles.pricingInputGroup}>
                      <div className={styles.pricingField}>
                        <span className={styles.pricingFieldHint}>%</span>
                        <input
                          ref={publicMarginRef}
                          className={styles.pricingInput}
                          type="number"
                          step="any"
                          placeholder="0.00"
                          value={publicMargin}
                          onChange={(e) => handlePublicMarginChange(e.target.value)}
                          onKeyDown={(e) => handleEnterKey(e, priceRef)}
                        />
                      </div>
                      <div className={styles.pricingField}>
                        <span className={styles.pricingFieldHint}>Gs.</span>
                        <input
                          ref={priceRef}
                          className={styles.pricingInput}
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={formData.price}
                          onChange={(e) => handlePublicPriceChange(e.target.value.replace(/[^0-9]/g, ""))}
                          onKeyDown={(e) => handleEnterKey(e, wholesaleMarginRef)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.pricingRow}>
                    <span className={styles.pricingLabel}>Precio mayorista</span>
                    <div className={styles.pricingInputGroup}>
                      <div className={styles.pricingField}>
                        <span className={styles.pricingFieldHint}>%</span>
                        <input
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
                      <div className={styles.pricingField}>
                        <span className={styles.pricingFieldHint}>Gs.</span>
                        <input
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
                <div className={styles.formGroup}>
                  <label className={styles.label}>Unidad de medida *</label>
                  <select
                    ref={unitTypeRef}
                    className={styles.select}
                    value={formData.unitType}
                    onChange={(e) => setFormData({ ...formData, unitType: e.target.value as UnitType })}
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
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Stock actual *</label>
                    <input ref={stockRef} className={styles.input} type="number" value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      onKeyDown={(e) => handleEnterKey(e, stockMinRef)}
                      placeholder={isUnitType(formData.unitType) ? "0" : "0.000"}
                      min="0"
                      step={isUnitType(formData.unitType) ? "1" : "0.001"}
                      required />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Stock mínimo</label>
                    <input ref={stockMinRef} className={styles.input} type="number" value={formData.stockMinimum}
                      onChange={(e) => setFormData({ ...formData, stockMinimum: e.target.value })}
                      onKeyDown={(e) => handleEnterKey(e, submitRef)}
                      placeholder={isUnitType(formData.unitType) ? "0" : "0.000"}
                      min="0"
                      step={isUnitType(formData.unitType) ? "1" : "0.001"} />
                    <span className={styles.fieldHint}>Alerta de reposición</span>
                  </div>
                </div>

                {/* ── Nota de ajuste — solo visible al editar si el stock cambió ── */}
                {editingProduct && parseFormNumber(formData.stock) !== editingProduct.stock && (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Motivo del ajuste de stock</label>
                    <input
                      className={styles.input}
                      value={formData.stockNotes}
                      onChange={(e) => setFormData({ ...formData, stockNotes: e.target.value })}
                      placeholder="Ej: Conteo físico, merma, corrección de error…"
                      maxLength={300}
                    />
                    <span className={styles.fieldHint}>
                      Stock actual: {formatStock(editingProduct.stock, editingProduct.unitType ?? "UNIT")} → nuevo: {formatStock(parseFormNumber(formData.stock), formData.unitType)}
                    </span>
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
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
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
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
