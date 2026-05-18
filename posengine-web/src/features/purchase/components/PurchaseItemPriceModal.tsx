import React, { useState, useEffect, useRef } from "react"
import { X, DollarSign, Percent, Package, ArrowRight } from "lucide-react"
import styles from "./PurchaseItemPriceModal.module.css"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"

interface Product {
  id: string
  name: string
  barcode?: string
  sku?: string
  cost?: number
  price: number
  stock: number
  unitType: string
}

export interface PriceModalData {
  quantity: number
  unitCost: number
  // Public price
  marginPercentage: number
  salePrice: number
  // Wholesale price
  wholesaleMarginPercentage: number
  wholesalePrice: number
}

interface PurchaseItemPriceModalProps {
  product: Product
  initialData: PriceModalData
  onSave: (data: PriceModalData) => void
  onClose: () => void
}

export function PurchaseItemPriceModal({ product, initialData, onSave, onClose }: PurchaseItemPriceModalProps) {
  const [quantity, setQuantity] = useState(String(initialData.quantity))
  const [unitCost, setUnitCost] = useState(String(initialData.unitCost))
  const [margin, setMargin] = useState(Number(initialData.marginPercentage).toFixed(2))
  const [salePrice, setSalePrice] = useState(String(initialData.salePrice))
  const [wholesaleMargin, setWholesaleMargin] = useState(Number(initialData.wholesaleMarginPercentage ?? 0).toFixed(2))
  const [wholesalePrice, setWholesalePrice] = useState(String(initialData.wholesalePrice ?? 0))

  const qtyRef = useRef<HTMLInputElement>(null)
  const costRef = useRef<HTMLInputElement>(null)
  const marginRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  const wholesaleMarginRef = useRef<HTMLInputElement>(null)
  const wholesalePriceRef = useRef<HTMLInputElement>(null)
  const saveBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  useEffect(() => {
    // Focus quantity on open
    setTimeout(() => {
      qtyRef.current?.focus()
      qtyRef.current?.select()
    }, 50)
  }, [])

  const calculateFromMargin = (cost: number, pct: number) => {
    const price = cost * (1 + pct / 100)
    setSalePrice(String(Math.round(price)))
  }

  const calculateFromPrice = (cost: number, price: number) => {
    if (cost <= 0) return
    const pct = ((price / cost) - 1) * 100
    setMargin(pct.toFixed(2))
  }

  const calculateWholesaleFromMargin = (cost: number, pct: number) => {
    const price = cost * (1 + pct / 100)
    setWholesalePrice(String(Math.round(price)))
  }

  const calculateWholesaleFromPrice = (cost: number, price: number) => {
    if (cost <= 0) return
    const pct = ((price / cost) - 1) * 100
    setWholesaleMargin(pct.toFixed(2))
  }

  const handleCostChange = (val: string) => {
    setUnitCost(val)
    const c = parseFloat(val)
    const m = parseFloat(margin)
    const wm = parseFloat(wholesaleMargin)
    if (!isNaN(c)) {
      if (!isNaN(m)) calculateFromMargin(c, m)
      if (!isNaN(wm)) calculateWholesaleFromMargin(c, wm)
    }
  }

  const handleMarginChange = (val: string) => {
    setMargin(val)
    const c = parseFloat(unitCost)
    const m = parseFloat(val)
    if (!isNaN(c) && !isNaN(m)) {
      calculateFromMargin(c, m)
    }
  }

  const handlePriceChange = (val: string) => {
    setSalePrice(val)
    const c = parseFloat(unitCost)
    const p = parseFloat(val)
    if (!isNaN(c) && !isNaN(p) && c > 0) {
      calculateFromPrice(c, p)
    }
  }

  const handleWholesaleMarginChange = (val: string) => {
    setWholesaleMargin(val)
    const c = parseFloat(unitCost)
    const m = parseFloat(val)
    if (!isNaN(c) && !isNaN(m)) {
      calculateWholesaleFromMargin(c, m)
    }
  }

  const handleWholesalePriceChange = (val: string) => {
    setWholesalePrice(val)
    const c = parseFloat(unitCost)
    const p = parseFloat(val)
    if (!isNaN(c) && !isNaN(p) && c > 0) {
      calculateWholesaleFromPrice(c, p)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLInputElement | HTMLButtonElement | null>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      nextRef.current?.focus()
      if (nextRef.current instanceof HTMLInputElement) {
        nextRef.current.select()
      }
    }
  }

  const handleSave = () => {
    const q = parseFloat(quantity)
    const c = parseFloat(unitCost)
    const m = parseFloat(margin)
    const p = parseFloat(salePrice)
    const wm = parseFloat(wholesaleMargin)
    const wp = parseFloat(wholesalePrice)

    if (isNaN(q) || q <= 0) { qtyRef.current?.focus(); return }
    if (isNaN(c) || c <= 0) { costRef.current?.focus(); return }

    onSave({
      quantity: q,
      unitCost: c,
      marginPercentage: isNaN(m) ? 0 : m,
      salePrice: isNaN(p) ? 0 : p,
      wholesaleMarginPercentage: isNaN(wm) ? 0 : wm,
      wholesalePrice: isNaN(wp) ? 0 : wp
    })
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.title}>
            <Package size={24} className={styles.titleIcon} />
            <div className={styles.titleText}>
              <span>Ajustar Precios</span>
              <small>{product.name}</small>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className={styles.content}>
          {/* Info section */}
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Costo Actual</span>
              <span className={styles.infoValue}>{formatCurrency(product.cost ?? 0)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Precio Actual</span>
              <span className={styles.infoValue}>{formatCurrency(product.price)}</span>
            </div>
          </div>

          <div className={styles.form}>
            {/* Cantidad */}
            <div className={styles.formGroup}>
              <label>Cantidad</label>
              <div className={styles.inputWrapper}>
                <input
                  ref={qtyRef}
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, costRef)}
                  placeholder="0"
                  step="any"
                />
              </div>
            </div>

            {/* Costo */}
            <div className={styles.formGroup}>
              <label>Costo Unitario</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}><DollarSign size={16} /></span>
                <input
                  ref={costRef}
                  type="text"
                  inputMode="numeric"
                  value={new Intl.NumberFormat("es-PY").format(Number(unitCost.replace(/\D/g, "") || 0))}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "")
                    handleCostChange(val)
                  }}
                  onKeyDown={e => handleKeyDown(e, marginRef)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className={styles.row}>
              {/* Margen Público */}
              <div className={styles.formGroup}>
                <label>Ganancia Público (%)</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon}><Percent size={16} /></span>
                  <input
                    ref={marginRef}
                    type="number"
                    value={margin}
                    onChange={e => handleMarginChange(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, priceRef)}
                    placeholder="0"
                    step="any"
                  />
                </div>
              </div>

              {/* Precio Público */}
              <div className={styles.formGroup}>
                <label>Precio Público</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon}><DollarSign size={16} /></span>
                  <input
                    ref={priceRef}
                    type="text"
                    inputMode="numeric"
                    value={new Intl.NumberFormat("es-PY").format(Number(salePrice.replace(/\D/g, "") || 0))}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, "")
                      handlePriceChange(val)
                    }}
                    onKeyDown={e => handleKeyDown(e, wholesaleMarginRef)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className={styles.row}>
              {/* Margen Mayorista */}
              <div className={styles.formGroup}>
                <label>Ganancia Mayorista (%)</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon}><Percent size={16} /></span>
                  <input
                    ref={wholesaleMarginRef}
                    type="number"
                    value={wholesaleMargin}
                    onChange={e => handleWholesaleMarginChange(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, wholesalePriceRef)}
                    placeholder="0"
                    step="any"
                  />
                </div>
              </div>

              {/* Precio Mayorista */}
              <div className={styles.formGroup}>
                <label>Precio Mayorista</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon}><DollarSign size={16} /></span>
                  <input
                    ref={wholesalePriceRef}
                    type="text"
                    inputMode="numeric"
                    value={new Intl.NumberFormat("es-PY").format(Number(wholesalePrice.replace(/\D/g, "") || 0))}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, "")
                      handleWholesalePriceChange(val)
                    }}
                    onKeyDown={e => handleKeyDown(e, saveBtnRef)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerHint}>
            <kbd className={styles.key}>Enter</kbd> avanzar / guardar
            <span className={styles.separator}>•</span>
            <kbd className={styles.key}>Esc</kbd> salir
          </div>
          <button 
            ref={saveBtnRef}
            className={styles.saveButton} 
            onClick={handleSave}
          >
            Confirmar <ArrowRight size={18} />
          </button>
        </footer>
      </div>
    </div>
  )
}
