"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { ProductSearchModal, type ProductSearchItem } from "@/src/shared/components/ProductSearchModal"
import { useLabelProductSearch } from "../hooks/useLabelProductSearch"
import { MAX_LABELS_PER_PRODUCT, parseLabelQuantity } from "../utils/label-selection"
import type { LabelProduct, SelectedLabelProduct } from "../types/label.types"
import type { ProductSearchResult } from "../types/product.types"
import styles from "../labels.module.css"

interface LabelProductPickerProps {
  selectedProducts: SelectedLabelProduct[]
  onAdd: (product: LabelProduct, quantity: number) => void
  onClose: () => void
}

export function LabelProductPicker({ selectedProducts, onAdd, onClose }: LabelProductPickerProps) {
  const { query, setQuery, page, setPage, results, loading, error } = useLabelProductSearch()
  const [pendingProduct, setPendingProduct] = useState<ProductSearchItem | null>(null)
  const [quantity, setQuantity] = useState("1")
  const quantityInputRef = useRef<HTMLInputElement>(null)

  const products = useMemo(() => results.items.map(toSearchItem), [results.items])
  const totalPages = Math.ceil(results.total / results.limit)
  const selectedQuantity = pendingProduct
    ? selectedProducts.find((item) => item.id === pendingProduct.id)?.quantity ?? 0
    : 0
  const remaining = MAX_LABELS_PER_PRODUCT - selectedQuantity
  const parsedQuantity = parseLabelQuantity(Number(quantity))
  const canAdd = !!pendingProduct && parsedQuantity !== null && parsedQuantity <= remaining

  useEffect(() => {
    if (pendingProduct) {
      quantityInputRef.current?.focus()
      quantityInputRef.current?.select()
    }
  }, [pendingProduct])

  const confirmAdd = () => {
    if (!pendingProduct || parsedQuantity === null || parsedQuantity > remaining) return
    onAdd(toLabelProduct(pendingProduct), parsedQuantity)
    onClose()
  }

  const footerContent = (
    <div className={styles.pickerFooter}>
      {error && <p className={styles.pickerError} role="alert">{error}</p>}
      {pendingProduct && (
        <form
          className={styles.pickerQuantityForm}
          onSubmit={(event) => {
            event.preventDefault()
            confirmAdd()
          }}
        >
          <span className={styles.pickerProductName} title={pendingProduct.name}>{pendingProduct.name}</span>
          <label className={styles.pickerQuantityControl}>
            <span>Etiquetas</span>
            <input
              ref={quantityInputRef}
              id="label-print-quantity"
              type="number"
              min={1}
              max={remaining}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <button className={styles.pickerAddButton} type="submit" disabled={!canAdd}>
            <Plus size={15} aria-hidden="true" /> Agregar
          </button>
        </form>
      )}
      {totalPages > 1 && (
        <nav className={styles.pickerPagination} aria-label="Paginación de productos">
          <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1 || loading} aria-label="Productos anteriores">
            <ChevronLeft size={16} />
          </button>
          <span>Página {page} de {totalPages}</span>
          <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages || loading} aria-label="Productos siguientes">
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  )

  return (
    <ProductSearchModal
      open
      products={products}
      loading={loading}
      searchValue={query}
      onSearchChange={(value) => {
        setPendingProduct(null)
        setQuantity("1")
        setQuery(value)
      }}
      onSelect={(product) => {
        setPendingProduct(product)
        setQuantity("1")
      }}
      onClose={onClose}
      showStock={false}
      emptyMessage={query.trim() ? "Sin resultados" : "No hay productos disponibles"}
      footerContent={footerContent}
    />
  )
}

function toSearchItem(product: ProductSearchResult): ProductSearchItem {
  const price = Number(product.price)
  const stock = Number(product.stock)
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? undefined,
    barcode: product.barcode ?? undefined,
    sku: product.sku ?? undefined,
    price: Number.isFinite(price) ? price : 0,
    stock: Number.isFinite(stock) ? stock : 0,
    imageUrl: product.imageUrl ?? undefined,
    unitType: product.unitType ?? "UNIT",
  }
}

function toLabelProduct(product: ProductSearchItem): LabelProduct {
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    sku: product.sku,
    description: product.description,
    imageUrl: product.imageUrl,
    price: product.price,
  }
}
