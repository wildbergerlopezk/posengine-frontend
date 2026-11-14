"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { AlertTriangle, Info, Loader2, Package, RotateCcw } from "lucide-react"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { API_BASE_URL } from "@/src/shared/config/api"
import { useCommercialCapabilities } from "@/src/shared/hooks/useCommercialCapabilities"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { clearIdempotencyKey, getOrCreateIdempotencyTimestamp, prepareIdempotencyKey } from "@/src/shared/api/idempotency"
import controls from "@/src/shared/styles/detailFormControls.module.css"
import styles from "./PurchaseReturnModal.module.css"

interface Product {
  id: string
  name: string
  barcode?: string
  sku?: string
  stock: number
  unitType?: string
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
  paymentType?: "CASH" | "CREDIT"
  debtBalance?: number
  total: number
  items?: PurchaseItem[]
}

interface ExistingReturn {
  status: string
  items: Array<{ purchaseItemId: string; quantity: number }>
}

interface Props {
  open: boolean
  inline?: boolean
  purchase: Purchase
  loading: boolean
  accessToken?: string
  cashSessionId?: string
  cashSessionLoading?: boolean
  onClose?: () => void
  onSuccess: () => void
}

export function PurchaseReturnModal({ open, inline = false, purchase, loading, accessToken = "", cashSessionId, cashSessionLoading = false, onClose, onSuccess }: Props) {
  const user = useAuthStore(state => state.user)
  const [reason, setReason] = useState("")
  const [creditNote, setCreditNote] = useState("")
  const [settlementDisposition, setSettlementDisposition] = useState<"REFUND_PENDING" | "REFUND_CASH" | "REFUND_TRANSFER" | "SUPPLIER_CREDIT">("REFUND_PENDING")
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [existingReturns, setExistingReturns] = useState<ExistingReturn[]>([])
  const [returnsLoading, setReturnsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { capabilities, loading: capabilitiesLoading, error: capabilitiesError, refresh: refreshCapabilities } = useCommercialCapabilities(accessToken)

  const returnCapability = capabilities?.purchaseReturns
  const settlementCapability = capabilities?.purchaseReturnSettlements
  const supplierCreditCapability = capabilities?.supplierCreditApplications
  const canCreateReturn = returnCapability?.enabled === true
  const canCreateSettlement = settlementCapability?.enabled === true
  const canSettleCash = canCreateSettlement && Boolean(cashSessionId) && !cashSessionLoading
  const returnBlockMessage = capabilitiesLoading
    ? "Verificando la disponibilidad de devoluciones…"
    : capabilitiesError || returnCapability?.reason || null

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }), [accessToken])

  const loadReturns = useCallback(async () => {
    setReturnsLoading(true)
    try {
      const params = new URLSearchParams({ purchaseId: purchase.id })
      const response = await fetch(`${API_BASE_URL}/purchase-returns?${params}`, { headers })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message || "No se pudo cargar el historial de devoluciones.")
      setExistingReturns(Array.isArray(data) ? data : [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial.")
    } finally {
      setReturnsLoading(false)
    }
  }, [headers, purchase.id])

  useEffect(() => {
    if (!open) return
    setReason("")
    setCreditNote("")
    setQuantities({})
    setSettlementDisposition("REFUND_PENDING")
    setError(null)
    void loadReturns()
  }, [open, loadReturns])

  const lines = (purchase.items ?? []).map((item) => {
    const returned = existingReturns
      .filter((entry) => entry.status === "CONFIRMED")
      .flatMap((entry) => entry.items)
      .filter((row) => row.purchaseItemId === item.id)
      .reduce((sum, row) => sum + Number(row.quantity), 0)
    const remaining = Math.max(0, item.quantity - returned)
    const quantity = Number(quantities[item.id] || 0)
    const amount = Math.round(quantity * item.unitCost * 100) / 100
    return { item, returned, remaining, available: Math.min(remaining, item.product.stock), quantity, amount }
  })
  const selected = lines.filter((line) => line.quantity > 0)
  const returnTotal = Math.round(selected.reduce((sum, line) => sum + line.amount, 0) * 100) / 100
  const debtOffset = Math.min(returnTotal, Math.max(0, Number(purchase.debtBalance ?? 0)))
  const excess = Math.round((returnTotal - debtOffset) * 100) / 100
  const safeDisposition = settlementDisposition === "REFUND_PENDING"
    ? "REFUND_PENDING"
    : !canCreateSettlement || (settlementDisposition === "REFUND_CASH" && !canSettleCash)
      ? "REFUND_PENDING"
      : settlementDisposition

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected.length) {
      setError("Indicá la cantidad de al menos un producto.")
      return
    }
    if (!canCreateReturn) {
      setError(returnBlockMessage || "La devolución no está disponible temporalmente.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const returnOperation = `PURCHASE_RETURN_CREATE:${purchase.id}`
      const returnDate = getOrCreateIdempotencyTimestamp(returnOperation, user?.id ?? "", user?.tenantId, new Date().toISOString())
      const payload = {
        purchaseId: purchase.id,
        returnDate,
        reason,
        creditNoteNumber: creditNote,
        items: selected.map(({ item, quantity }) => ({ purchaseItemId: item.id, quantity })),
      }
      const idempotencyKey = await prepareIdempotencyKey(returnOperation, user?.id ?? "", user?.tenantId, payload)
      const response = await fetch(`${API_BASE_URL}/purchase-returns`, {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      })
      const created = await response.json().catch(() => null)
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 409) clearIdempotencyKey(returnOperation, user?.id ?? "", user?.tenantId)
        throw new Error(created?.message || "Error al crear la devolución.")
      }

      if (created.status !== "CONFIRMED") {
        const confirmResponse = await fetch(`${API_BASE_URL}/purchase-returns/${created.id}/confirm`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(excess > 0.01 ? { settlementDisposition: safeDisposition } : {}),
        })
        const confirmation = await confirmResponse.json().catch(() => null)
        if (!confirmResponse.ok) throw new Error(confirmation?.message || "Devolución creada, pero no se pudo confirmar.")
      }

      clearIdempotencyKey(returnOperation, user?.id ?? "", user?.tenantId)
      onSuccess()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la devolución.")
      refreshCapabilities()
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <section className={styles.inlinePanel} aria-label="Nueva devolución de compra">
      <header className={styles.inlineHeader}>
        <div className={styles.headerTitle}>
          <RotateCcw className={styles.headerIcon} size={18} aria-hidden="true" />
          <div>
            <h3>Nueva devolución</h3>
            <p>Factura {purchase.invoiceNumber} · {purchase.supplier.name}</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className={styles.inlineBody}>
        {!canCreateReturn && <div className={styles.notice} role="status"><Info size={15} aria-hidden="true" />{returnBlockMessage || "La devolución no está disponible temporalmente."} El historial sigue disponible.</div>}
        {error && <div className={styles.errorBanner} role="alert"><AlertTriangle size={15} aria-hidden="true" />{error}</div>}
        {loading || returnsLoading ? <p className={styles.empty}><Loader2 size={15} className={styles.spinner} /> Cargando cantidades devueltas…</p> : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead><tr><th>Producto</th><th className={styles.numeric}>Original</th><th className={styles.numeric}>Devuelta</th><th className={styles.numeric}>Restante</th><th className={styles.numeric}>A devolver</th><th className={styles.numeric}>Importe</th></tr></thead>
              <tbody>
                {lines.map(({ item, returned, remaining, available, quantity, amount }) => (
                  <tr key={item.id}>
                    <td className={styles.productCell}>
                      <span className={styles.productName} title={item.product.name}>{item.product.name}</span>
                      <small>{item.product.sku || item.product.barcode || "Sin código"} · Stock {item.product.stock}</small>
                    </td>
                    <td className={styles.numeric}>{item.quantity}</td>
                    <td className={styles.numeric}>{returned}</td>
                    <td className={styles.numeric}>{remaining}</td>
                    <td>
                      <input
                        className={`${controls.control} ${styles.quantityInput}`}
                        aria-label={`Cantidad a devolver: ${item.product.name}`}
                        type="number"
                        min="0"
                        max={available}
                        step={item.product.unitType === "UNIT" ? "1" : "0.001"}
                        value={quantities[item.id] ?? ""}
                        onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                    </td>
                    <td className={styles.numeric}>{formatCurrency(amount || quantity * item.unitCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <section className={styles.formBlock} aria-labelledby="purchase-return-reason-heading">
          <h4 className={styles.blockTitle} id="purchase-return-reason-heading">Motivo de devolución</h4>
          <div className={styles.inputGrid}>
            <label className={controls.label}>Motivo
              <input className={controls.control} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Describí brevemente el motivo" disabled={submitting} required />
            </label>
            <label className={controls.label}>Nota de crédito (opcional)
              <input className={controls.control} value={creditNote} onChange={(event) => setCreditNote(event.target.value)} maxLength={120} placeholder="Número de nota de crédito" disabled={submitting} />
            </label>
          </div>
        </section>

        <section className={`${styles.formBlock} ${styles.financeBlock}`} aria-labelledby="purchase-return-finance-heading">
          <h4 className={styles.blockTitle} id="purchase-return-finance-heading">Resumen financiero</h4>
          <div className={styles.summaryBox} aria-live="polite">
          <div className={styles.summaryValues}>
            <div><span>Importe a devolver</span><strong>{formatCurrency(returnTotal)}</strong></div>
            <div><span>Reducción de deuda</span><strong>{formatCurrency(debtOffset)}</strong></div>
            <div><span>Excedente</span><strong>{formatCurrency(excess)}</strong></div>
          </div>
          </div>
        </section>

        {excess > 0.01 && <section className={`${styles.formBlock} ${styles.liquidationBlock}`} aria-labelledby="purchase-return-settlement-heading">
          <h4 className={styles.blockTitle} id="purchase-return-settlement-heading">Liquidación del excedente</h4>
          <label className={controls.label}>Destino
            <select className={controls.control} value={safeDisposition} onChange={(event) => setSettlementDisposition(event.target.value as typeof settlementDisposition)}>
              <option value="REFUND_PENDING">Registrar como reembolso pendiente</option>
              <option value="REFUND_CASH" disabled={!canSettleCash}>Efectivo ya recibido en caja abierta</option>
              <option value="REFUND_TRANSFER" disabled={!canCreateSettlement}>Transferencia ya recibida</option>
              <option value="SUPPLIER_CREDIT" disabled={!canCreateSettlement}>Crédito del proveedor</option>
            </select>
          </label>
          <p className={styles.infoText}>La deuda y las cuotas se reducen primero; el destino define cómo se registra el excedente.</p>
          {!canCreateSettlement && settlementCapability?.reason && <p className={styles.helperText} role="status">{settlementCapability.reason} Podés registrar la devolución y dejar el reembolso pendiente.</p>}
          {canCreateSettlement && !cashSessionId && !cashSessionLoading && <p className={styles.helperText} role="status">Abrí una sesión de caja para registrar un reembolso en efectivo.</p>}
          {safeDisposition === "SUPPLIER_CREDIT" && supplierCreditCapability && !supplierCreditCapability.enabled && supplierCreditCapability.reason && <p className={styles.helperText} role="status">{supplierCreditCapability.reason} El crédito puede registrarse, pero no aplicarse a otra compra hasta habilitar esa operación.</p>}
        </section>}

        <div className={styles.confirmation}>
          {!canCreateReturn && <p className={styles.blockedNotice} role="status">{returnBlockMessage || "La devolución no está disponible temporalmente."}</p>}
          {capabilitiesError && <button type="button" className={styles.retryButton} onClick={refreshCapabilities}>Volver a verificar</button>}
          <button type="submit" className={styles.submitBtn} disabled={submitting || loading || returnsLoading || !selected.length || !canCreateReturn || capabilitiesLoading || !capabilities} aria-describedby={!canCreateReturn ? "purchase-return-blocked-reason" : undefined}>
            {submitting ? <><Loader2 className={styles.spinner} size={16} /> Procesando…</> : <><Package size={16} /> Confirmar devolución</>}
          </button>
          {!canCreateReturn && <span id="purchase-return-blocked-reason" className={styles.srOnly}>{returnBlockMessage}</span>}
        </div>
      </form>
      {onClose && !inline && <button type="button" className={styles.closeInline} onClick={onClose}>Cerrar</button>}
    </section>
  )
}
