"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Header } from "@/src/shared/components/Header"
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Package, AlertTriangle } from "lucide-react"
import { mockProducts, mockCategories } from "@/src/shared/api/mock-data"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import type { Product } from "@/src/shared/types"
import styles from "./ProductsPage.module.css"

export function ProductsPage() {
  const { user } = useAuthStore()
  const [products, setProducts] = useState<Product[]>(mockProducts)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    name: "",
    barcode: "",
    categoryId: "",
    subcategoryId: "",
    purchasePrice: "",
    salePrice: "",
    stock: "",
    minStock: "",
  })

  const parentCategories = mockCategories.filter((c) => !c.parentId)
  const subcategories = mockCategories.filter((c) => c.parentId === formData.categoryId)

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) || product.barcode?.includes(searchQuery),
  )

  const resetForm = () => {
    setFormData({
      name: "",
      barcode: "",
      categoryId: "",
      subcategoryId: "",
      purchasePrice: "",
      salePrice: "",
      stock: "",
      minStock: "",
    })
    setEditingProduct(null)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      barcode: product.barcode || "",
      categoryId: product.categoryId || "",
      subcategoryId: product.subcategoryId || "",
      purchasePrice: product.purchasePrice.toString(),
      salePrice: product.salePrice.toString(),
      stock: product.stock.toString(),
      minStock: product.minStock.toString(),
    })
    setIsDialogOpen(true)
    setOpenDropdown(null)
  }

  const handleDelete = (productId: string) => {
    setProducts(products.filter((p) => p.id !== productId))
    setOpenDropdown(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const productData: Product = {
      id: editingProduct?.id || `p-${Date.now()}`,
      tenantId: 1,
      name: formData.name,
      barcode: formData.barcode || undefined,
      categoryId: formData.categoryId || undefined,
      subcategoryId: formData.subcategoryId || undefined,
      purchasePrice: Number.parseFloat(formData.purchasePrice),
      salePrice: Number.parseFloat(formData.salePrice),
      stock: Number.parseInt(formData.stock),
      minStock: Number.parseInt(formData.minStock),
      isActive: true,
      createdAt: editingProduct?.createdAt || new Date(),
      updatedAt: new Date(),
    }

    if (editingProduct) {
      setProducts(products.map((p) => (p.id === editingProduct.id ? productData : p)))
    } else {
      setProducts([...products, productData])
    }

    setIsDialogOpen(false)
    resetForm()
  }

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return "-"
    const category = mockCategories.find((c) => c.id === categoryId)
    return category?.name || "-"
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
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
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button className={styles.newButton} onClick={() => setIsDialogOpen(true)}>
            <Plus size={16} />
            Nuevo producto
          </button>
        </div>

        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead className={styles.tableHeader}>
              <tr>
                <th className={styles.tableHeaderCell}>Producto</th>
                <th className={styles.tableHeaderCell}>Código</th>
                <th className={styles.tableHeaderCell}>Categoría</th>
                <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Compra</th>
                <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Venta</th>
                <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Stock</th>
                <th className={`${styles.tableHeaderCell} ${styles.tableHeaderCellRight}`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.emptyState}>
                      <Package size={32} className={styles.emptyStateIcon} />
                      <p>No se encontraron productos</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className={styles.tableRow}>
                    <td className={styles.tableCell}>
                      <div className={styles.productCell}>
                        <div className={styles.productIcon}>
                          <Package size={20} />
                        </div>
                        <div className={styles.productInfo}>
                          <span className={styles.productName}>{product.name}</span>
                          {product.stock <= product.minStock && (
                            <span className={`${styles.badge} ${styles.badgeWarning}`}>
                              <AlertTriangle size={12} />
                              Stock bajo
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={styles.tableCell}>
                      <span className={styles.monoText}>{product.barcode || "-"}</span>
                    </td>
                    <td className={styles.tableCell}>{getCategoryName(product.categoryId)}</td>
                    <td className={`${styles.tableCell} ${styles.tableCellRight}`}>
                    </td>
                    <td className={`${styles.tableCell} ${styles.tableCellRight} ${styles.priceText}`}>
                    </td>
                    <td className={`${styles.tableCell} ${styles.tableCellRight}`}>
                      <span className={product.stock <= product.minStock ? styles.stockWarning : ""}>
                        {product.stock}
                      </span>
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
                              <Pencil size={14} />
                              Editar
                            </button>
                            <button
                              className={`${styles.dropdownItem} ${styles.dropdownItemDestructive}`}
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 size={14} />
                              Eliminar
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
        </div>
      </div>

      {/* Product Modal */}
      {isDialogOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsDialogOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingProduct ? "Editar producto" : "Nuevo producto"}</h2>
              <p className={styles.modalDescription}>
                {editingProduct ? "Modifica los datos del producto" : "Completa los datos para crear un nuevo producto"}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.modalContent}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Nombre *</label>
                  <input
                    className={styles.input}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre del producto"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Código de barras</label>
                  <input
                    className={styles.input}
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="7790000000000"
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Categoría</label>
                    <select
                      className={styles.select}
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subcategoryId: "" })}
                    >
                      <option value="">Seleccionar</option>
                      {parentCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Subcategoría</label>
                    <select
                      className={styles.select}
                      value={formData.subcategoryId}
                      onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                      disabled={!formData.categoryId || subcategories.length === 0}
                    >
                      <option value="">Seleccionar</option>
                      {subcategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Precio de compra *</label>
                    <input
                      className={styles.input}
                      type="number"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Precio de venta *</label>
                    <input
                      className={styles.input}
                      type="number"
                      value={formData.salePrice}
                      onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Stock actual *</label>
                    <input
                      className={styles.input}
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Stock mínimo *</label>
                    <input
                      className={styles.input}
                      type="number"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    setIsDialogOpen(false)
                    resetForm()
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.submitButton}>
                  {editingProduct ? "Guardar cambios" : "Crear producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
