import React, { useState, useEffect } from "react"
import { X, RotateCcw, AlertTriangle, Package, Loader2, Info } from "lucide-react"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { API_BASE_URL } from "@/src/shared/config/api"
import styles from "./PurchaseReturnModal.module.css"

interface Product {
  id: string
  name: string
  barcode?: string
  sku?: string
  stock: number
}

interface PurchaseItem {
  id: string
  productId: string
  quantity: number
  unitCost: number
  total: number
  product: Product
}

interface Purchase {
  id: string
  invoiceNumber: string
  supplier: { name: string }
  total: number
  items?: PurchaseItem[]
}

interface Props {
  open: boolean
  purchase: Purchase
  loading: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PurchaseReturnModal({ open, purchase, loading, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState("")
  const [creditNote, setCreditNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const API_BASE = API_BASE_URL

  useEffect(() => {
    if (open) {
      setReason("")
      setCreditNote("")
      setError(null)
    }
  }, [open])

  if (!open) return null

  // Verificar si hay stock suficiente para una devolución total
  const insufficientStockItems = purchase.items?.filter(item => item.product.stock < item.quantity) || []
  const canReturnTotal = insufficientStockItems.length === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!canReturnTotal) {
      setError("No se puede realizar la devolución total porque algunos productos ya fueron vendidos.")
      return
    }

    const itemsToReturn = purchase.items?.map(item => ({ 
      purchaseItemId: item.id, 
      quantity: item.quantity 
    })) || []

    setSubmitting(true)
    setError(null)

    try {
      const token = localStorage.getItem("auth-storage") 
        ? JSON.parse(localStorage.getItem("auth-storage")!).state.accessToken 
        : ""

      const res = await fetch(`${API_BASE}/purchase-returns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          purchaseId: purchase.id,
          returnDate: new Date().toISOString(),
          reason,
          creditNoteNumber: creditNote,
          items: itemsToReturn
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Error al procesar devolución")

      const confirmRes = await fetch(`${API_BASE}/purchase-returns/${data.id}/confirm`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      })

      if (!confirmRes.ok) {
        const confirmData = await confirmRes.json()
        throw new Error(confirmData.message || "Devolución creada pero no se pudo confirmar")
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <RotateCcw className={styles.headerIcon} size={20} />
            <div>
              <h3>Devolución Total de Factura</h3>
              <p>Factura {purchase.invoiceNumber} — {purchase.supplier.name}</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} disabled={submitting}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.body}>
          {error && (
            <div className={styles.errorBanner}>
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {!canReturnTotal && (
            <div className={styles.errorBanner}>
              <AlertTriangle size={16} />
              <div>
                <p><strong>Stock insuficiente para devolución total:</strong></p>
                <ul className={styles.errorList}>
                  {insufficientStockItems.map(item => (
                    <li key={item.id}>
                      {item.product.name}: Necesitas {item.quantity}, pero solo hay {item.product.stock} en stock.
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className={styles.infoBox}>
            <Info size={16} />
            <p>Se devolverán todos los productos de esta factura al proveedor y se descontarán del stock.</p>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className={styles.center}>Cantidad</th>
                  <th className={styles.center}>Stock Actual</th>
                  <th className={styles.right}>Costo</th>
                  <th className={styles.right}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items?.map(item => {
                  const hasStock = item.product.stock >= item.quantity
                  return (
                    <tr key={item.id} className={!hasStock ? styles.rowError : ""}>
                      <td>
                        <div className={styles.productInfo}>
                          <span className={styles.productName}>{item.product.name}</span>
                          <span className={styles.productSku}>{item.product.sku || item.product.barcode || "—"}</span>
                        </div>
                      </td>
                      <td className={styles.center}>
                        <span className={styles.qtyMain}>{item.quantity}</span>
                      </td>
                      <td className={styles.center}>
                        <span className={`${styles.stockValue} ${!hasStock ? styles.stockWarning : ""}`}>
                          {item.product.stock}
                        </span>
                      </td>
                      <td className={styles.right}>{formatCurrency(item.unitCost)}</td>
                      <td className={styles.right}>
                        <span className={styles.itemTotal}>
                          {formatCurrency(item.total)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.formFooter}>
            <div className={styles.inputsRow}>
              <div className={styles.inputGroup}>
                <label>Nro. Nota de Crédito (opcional)</label>
                <input
                  type="text"
                  value={creditNote}
                  onChange={e => setCreditNote(e.target.value)}
                  placeholder="Ej: 001-001-0000123"
                  disabled={submitting}
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Motivo de la devolución</label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Ej: Devolución total por mercadería dañada..."
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className={styles.summaryBox}>
              <div className={styles.summaryRow}>
                <span>Monto Total a Devolver</span>
                <span className={styles.summaryTotal}>{formatCurrency(purchase.total)}</span>
              </div>
              <button 
                type="submit" 
                className={styles.submitBtn}
                disabled={submitting || !canReturnTotal}
              >
                {submitting ? (
                  <>
                    <Loader2 className={styles.spinner} size={18} />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Package size={18} />
                    Confirmar Devolución Total
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
