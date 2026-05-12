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
  marginPercentage: number
  salePrice: number
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
  const [margin, setMargin] = useState(String(initialData.marginPercentage))
  const [salePrice, setSalePrice] = useState(String(initialData.salePrice))

  const qtyRef = useRef<HTMLInputElement>(null)
  const costRef = useRef<HTMLInputElement>(null)
  const marginRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  const saveBtnRef = useRef<HTMLButtonElement>(null)

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

  const handleCostChange = (val: string) => {
    setUnitCost(val)
    const c = parseFloat(val)
    const m = parseFloat(margin)
    if (!isNaN(c) && !isNaN(m)) {
      calculateFromMargin(c, m)
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

    if (isNaN(q) || q <= 0) { qtyRef.current?.focus(); return }
    if (isNaN(c) || c < 0) { costRef.current?.focus(); return }

    onSave({
      quantity: q,
      unitCost: c,
      marginPercentage: isNaN(m) ? 0 : m,
      salePrice: isNaN(p) ? 0 : p
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
                  type="number"
                  value={unitCost}
                  onChange={e => handleCostChange(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, marginRef)}
                  placeholder="0"
                  step="any"
                />
              </div>
            </div>

            <div className={styles.row}>
              {/* Margen */}
              <div className={styles.formGroup}>
                <label>Ganancia (%)</label>
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

              {/* Precio Venta */}
              <div className={styles.formGroup}>
                <label>Precio Venta</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon}><DollarSign size={16} /></span>
                  <input
                    ref={priceRef}
                    type="number"
                    value={salePrice}
                    onChange={e => handlePriceChange(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, saveBtnRef)}
                    placeholder="0"
                    step="any"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerHint}>
            <kbd className={styles.key}>Enter</kbd> para avanzar y guardar
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
