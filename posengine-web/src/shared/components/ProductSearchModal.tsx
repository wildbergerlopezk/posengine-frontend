"use client"

import type React from "react"
import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react"
import { Search, X, Package, Loader2 } from "lucide-react"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import styles from "./ProductSearchModal.module.css"

export interface ProductSearchItem {
  id: string
  name: string
  barcode?: string
  sku?: string
  price: number
  stock: number
  cost?: number
  unitType: "UNIT" | "KG" | "G" | "L" | "ML" | "MG"
}

/** Lo que el padre puede leer/hacer a través del ref */
export interface ProductSearchModalHandle {
  /** Producto actualmente resaltado en la lista, o null si la lista está vacía */
  getSelectedProduct: () => ProductSearchItem | null
}

interface ProductSearchModalProps {
  /** Controla si el modal está abierto */
  open: boolean
  /** Lista de productos a mostrar */
  products: ProductSearchItem[]
  /** Si se están cargando los productos */
  loading?: boolean
  /** Valor actual del campo de búsqueda */
  searchValue: string
  /** Callback cuando cambia el texto de búsqueda */
  onSearchChange: (value: string) => void
  /** Callback cuando se selecciona un producto */
  onSelect: (product: ProductSearchItem) => void
  /** Callback para cerrar el modal */
  onClose: () => void
  /** 
   * Qué precio mostrar en la columna derecha. 
   * "price"  → precio de venta público (default, para ventas) 
   * "cost"   → costo unitario (para compras) 
   */
  priceColumn?: "price" | "cost"
  /** 
   * Shortcuts extra que el padre quiere interceptar dentro del input de búsqueda. 
   * Recibe el KeyboardEvent ANTES de que el componente lo procese. 
   * Si el padre llama e.preventDefault(), el componente no ejecuta su lógica por defecto. 
   * Ejemplo: PurchasePage usa esto para capturar F8 y abrir el historial de precios. 
   */
  onExtraKeyDown?: (e: React.KeyboardEvent, selectedProduct: ProductSearchItem | null) => void
  /** Hints extra que se muestran en la barra inferior (además de los básicos) */
  extraHints?: React.ReactNode
}

function isUnitType(unitType?: string) {
  return !unitType || unitType === "UNIT"
}

function formatQuantity(qty: number, unitType?: string) {
  if (isUnitType(unitType)) return String(qty)
  return qty % 1 === 0 ? String(qty) : qty.toFixed(3)
}

export const ProductSearchModal = forwardRef<ProductSearchModalHandle, ProductSearchModalProps>(
  function ProductSearchModal(
    {
      open,
      products,
      loading = false,
      searchValue,
      onSearchChange,
      onSelect,
      onClose,
      priceColumn = "price",
      onExtraKeyDown,
      extraHints,
    },
    ref
  ) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  // Exponer getSelectedProduct al padre via ref
  useImperativeHandle(ref, () => ({
    getSelectedProduct: () => products[selectedIndex] ?? null,
  }), [products, selectedIndex])

  // Resetear selección cuando cambian los productos
  useEffect(() => {
    setSelectedIndex(0)
  }, [products])

  // Foco al abrir
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Primero dar oportunidad al padre de interceptar (ej. F8 en PurchasePage)
      if (onExtraKeyDown) {
        onExtraKeyDown(e, products[selectedIndex] ?? null)
        // Si el padre llamó preventDefault(), no seguir
        if (e.defaultPrevented) return
      }

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((p) => Math.min(products.length - 1, p + 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((p) => Math.max(0, p - 1))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const p = products[selectedIndex]
        if (p) onSelect(p)
      } else if (e.key === "Escape") {
        onClose()
      }
    },
    [products, selectedIndex, onSelect, onClose, onExtraKeyDown]
  )

  if (!open) return null

  const displayPrice = (product: ProductSearchItem) => {
    if (priceColumn === "cost") {
      return product.cost != null ? formatCurrency(product.cost) : "—"
    }
    return formatCurrency(product.price)
  }

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Buscar producto"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <h2 className={styles.title}>Agregar producto</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Search input ── */}
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={searchRef}
            className={styles.searchInput}
            placeholder="Buscar por nombre, código o SKU…"
            value={searchValue}
            onChange={(e) => {
              onSearchChange(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* ── Product list — altura fija siempre ── */}
        <div className={styles.listWrapper}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 size={24} className={styles.spinner} />
            </div>
          ) : products.length === 0 ? (
            <div className={styles.emptyState}>
              <Package size={28} className={styles.emptyIcon} />
              <p>{searchValue.trim() ? "Sin resultados" : "Cargando productos…"}</p>
            </div>
          ) : (
            <ul className={styles.list} role="listbox">
              {products.map((product, idx) => (
                <li
                  key={product.id}
                  role="option"
                  aria-selected={selectedIndex === idx}
                >
                  <button
                    type="button"
                    className={`${styles.row} ${selectedIndex === idx ? styles.rowSelected : ""}`}
                    onClick={() => onSelect(product)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className={styles.colCode}>
                      {product.barcode || product.sku || "—"}
                    </span>
                    <span className={styles.colName}>{product.name}</span>
                    <span className={styles.colUnit}>
                      {!isUnitType(product.unitType) ? product.unitType : ""}
                    </span>
                    <span className={styles.colStock}>
                      Stock: {formatQuantity(product.stock, product.unitType)}
                    </span>
                    <span className={styles.colPrice}>{displayPrice(product)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Hints bar ── */}
        <div className={styles.hints}>
          <span><kbd>↑↓</kbd> Navegar</span>
          <span><kbd>Enter</kbd> Seleccionar</span>
          {extraHints}
          <span><kbd>Esc</kbd> Cerrar</span>
        </div>

      </div>
    </div>
  )
  }
)
