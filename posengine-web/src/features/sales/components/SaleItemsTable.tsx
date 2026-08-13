"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Trash2, ShoppingCart, Check, Loader2, Plus, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import styles from "../pages/SalesPage.module.css"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"

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

interface SaleItemsTableProps {
  items: SaleItem[]
  setItems: React.Dispatch<React.SetStateAction<SaleItem[]>>
  paymentMethod: "CASH" | "CREDIT"
  onPaymentMethodChange: (method: "CASH" | "CREDIT") => void
  selectedCustomer: Customer | null
  onOpenCustomerModal: () => void
  onOpenProductModal: () => void
  total: number
  submitting: boolean
  success: boolean
  salesDisabled: boolean
  onOpenConfirmModal: () => void
  onTriggerPriceSelector: (index: number) => void
}

function isUnitType(unitType: string) {
  return unitType === "UNIT"
}

function formatQuantity(qty: number, unitType: string) {
  if (isUnitType(unitType)) return String(qty)
  return qty % 1 === 0 ? String(qty) : qty.toFixed(3)
}

export function SaleItemsTable({
  items,
  setItems,
  paymentMethod,
  onPaymentMethodChange,
  selectedCustomer,
  onOpenCustomerModal,
  onOpenProductModal,
  total,
  submitting,
  success,
  salesDisabled,
  onOpenConfirmModal,
  onTriggerPriceSelector,
}: SaleItemsTableProps) {
  // ── Edición inline ─────────────────────────────────────────────────────────
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [editingField, setEditingField] = useState<"quantity" | "unitPrice" | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const editingInputRef = useRef<HTMLInputElement>(null)

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
        const qty = isUnitType(product.unitType) ? Math.round(val) : val
        return { ...item, quantity: qty }
      }

      if (editingField === "unitPrice") {
        const safePrice = Math.max(val, item.product.price)
        return { ...item, unitPrice: safePrice }
      }

      return item
    }))

    const targetIndex = editingRowIndex
    const wasQuantityEdit = editingField === "quantity"
    cancelEdit()

    if (wasQuantityEdit && targetIndex !== null) {
      onTriggerPriceSelector(targetIndex)
    }
  }, [editingRowIndex, editingField, editingValue, cancelEdit, setItems, onTriggerPriceSelector])

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
    cancelEdit()
  }

  return (
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
            onClick={onOpenCustomerModal}
            style={{ marginLeft: 8 }}
          >
            Cliente: {selectedCustomer ? selectedCustomer.name : "Consumidor Final"} <kbd className={styles.kbdInline} style={{ marginLeft: 6 }}>F8</kbd>
          </button>
          <button
            type="button"
            className={`${tableStyles.newButton} ${paymentMethod === "CREDIT" ? styles.creditModeBtn : styles.cashModeBtn}`}
            onClick={() => onPaymentMethodChange(paymentMethod === "CASH" ? "CREDIT" : "CASH")}
            style={{ marginLeft: 8 }}
          >
            Tipo de venta: {paymentMethod === "CASH" ? "Contado" : "Crédito"} <kbd className={styles.kbdInline} style={{ marginLeft: 6 }}>F9</kbd>
          </button>
          <button
            type="button"
            className={tableStyles.newButton}
            onClick={onOpenProductModal}
            style={{ marginLeft: 8 }}
          >
            <Plus size={15} /> Agregar producto <span className={styles.shortcutHint}><kbd>F2</kbd></span>
          </button>
        </div>
      </div>

      {paymentMethod === "CREDIT" && selectedCustomer && (selectedCustomer.currentDebt + Math.max(0, total) > selectedCustomer.creditLimit) && (
        <div className={tableStyles.errorBanner} style={{ marginTop: 8, marginBottom: 8 }}>
          <AlertCircle size={16} />
          Límite de crédito superado para {selectedCustomer.name}. Disponible: {formatCurrency(Math.max(0, selectedCustomer.creditLimit - selectedCustomer.currentDebt))}, Requerido: {formatCurrency(total)}
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
              <td colSpan={9}>
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
                          e.preventDefault()
                          e.stopPropagation()
                          commitEdit()
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
              onClick={onOpenConfirmModal}
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
  )
}
