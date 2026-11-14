"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Loader2, RotateCcw } from "lucide-react"
import { API_BASE_URL } from "@/src/shared/config/api"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { useCashSession } from "@/src/features/cash-session/hooks/useCashSession"
import { useCommercialCapabilities } from "@/src/shared/hooks/useCommercialCapabilities"
import controls from "@/src/shared/styles/detailFormControls.module.css"
import styles from "./SaleReturnPanel.module.css"

type Item = { id: string; quantity: number; unitPrice: number; product: { name: string; unitType: string } }
type Sale = { id: string; total: number; remainingBalance: number; status: string; items?: Item[] }
type SaleReturn = {
  id: string; status: string; returnDate: string; total: number; debtOffsetAmount: number
  items: Array<{ saleItemId: string; quantity: number; total: number; disposition: string; product: { name: string } }>
  settlements: Array<{ id: string; amount: number; status: string; receipts: Array<{ amount: number; paymentMethod: string; effectiveAt: string }> }>
}

const toLocalDateTimeInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

export function SaleReturnPanel({ sale, accessToken, onChanged }: { sale: Sale; accessToken: string; onChanged: () => void }) {
  const headers = useMemo(() => ({ "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }), [accessToken])
  const { capabilities, loading: capabilitiesLoading, error: capabilitiesError, refresh: refreshCapabilities } = useCommercialCapabilities(accessToken)
  const { session: activeCashSession, loading: cashSessionLoading } = useCashSession()
  const [returns, setReturns] = useState<SaleReturn[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [dispositions, setDispositions] = useState<Record<string, "RESTOCKABLE" | "DAMAGED">>({})
  const [reason, setReason] = useState("")
  const [settlement, setSettlement] = useState<"REFUND_PENDING" | "REFUND_CASH" | "REFUND_TRANSFER">("REFUND_PENDING")
  const [receiptDrafts, setReceiptDrafts] = useState<Record<string, { amount: string; method: "CASH" | "TRANSFER"; date: string }>>({})

  const returnCapability = capabilities?.saleReturns
  const refundCapability = capabilities?.saleReturnRefunds
  const canCreateReturn = returnCapability?.enabled === true
  const canSettleRefund = refundCapability?.enabled === true
  const canRefundCash = canSettleRefund && Boolean(activeCashSession) && !cashSessionLoading
  const returnBlockMessage = capabilitiesLoading
    ? "Verificando la disponibilidad de devoluciones…"
    : capabilitiesError || returnCapability?.reason || null
  const safeSettlement = !canSettleRefund || (settlement === "REFUND_CASH" && !canRefundCash)
    ? "REFUND_PENDING"
    : settlement

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/sale-returns/by-sale/${sale.id}`, { headers })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message || "No se pudo cargar el historial de devoluciones.")
      setReturns(data)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Error al cargar devoluciones.") }
    finally { setLoading(false) }
  }, [headers, sale.id])

  useEffect(() => { void load() }, [load])

  const lines = (sale.items ?? []).map(item => {
    const already = returns.filter(r => r.status === "CONFIRMED").flatMap(r => r.items)
      .filter(row => row.saleItemId === item.id).reduce((sum, row) => sum + row.quantity, 0)
    const quantity = Number(quantities[item.id] || 0)
    return { item, already, available: Math.max(0, item.quantity - already), quantity, amount: Math.round(quantity * item.unitPrice * 100) / 100 }
  })
  const selected = lines.filter(line => line.quantity > 0)
  const returnTotal = Math.round(selected.reduce((sum, line) => sum + line.amount, 0) * 100) / 100
  const debtOffset = Math.min(returnTotal, Math.max(0, sale.remainingBalance))
  const refund = Math.round((returnTotal - debtOffset) * 100) / 100

  const confirmReturn = async () => {
    if (!selected.length) { setError("Indicá la cantidad de al menos un producto."); return }
    if (!canCreateReturn) { setError(returnBlockMessage || "La devolución no está disponible temporalmente."); return }
    setBusy(true); setError(null)
    try {
      const createResponse = await fetch(`${API_BASE_URL}/sale-returns`, {
        method: "POST", headers,
        body: JSON.stringify({ saleId: sale.id, returnDate: new Date().toISOString(), reason, items: selected.map(({ item, quantity }) => ({ saleItemId: item.id, quantity, disposition: dispositions[item.id] || "RESTOCKABLE" })) }),
      })
      const created = await createResponse.json().catch(() => null)
      if (!createResponse.ok) throw new Error(created?.message || "No se pudo crear la devolución.")
      const confirmResponse = await fetch(`${API_BASE_URL}/sale-returns/${created.id}/confirm`, {
        method: "PATCH", headers,
        body: JSON.stringify(refund > 0.01 ? { settlementDisposition: safeSettlement } : {}),
      })
      const result = await confirmResponse.json().catch(() => null)
      if (!confirmResponse.ok) throw new Error(result?.message || "No se pudo confirmar la devolución.")
      setQuantities({}); setReason(""); await load(); onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la devolución.")
      refreshCapabilities()
    }
    finally { setBusy(false) }
  }

  const registerReceipt = async (settlementId: string) => {
    const draft = receiptDrafts[settlementId]
    if (!draft?.amount || Number(draft.amount) <= 0) { setError("Ingresá un importe recibido válido."); return }
    if (!canSettleRefund) { setError(refundCapability?.reason || "El registro de reembolsos no está disponible temporalmente."); return }
    if (draft.method === "CASH" && (!activeCashSession || cashSessionLoading)) { setError("Abrí una sesión de caja para registrar el reembolso en efectivo."); return }
    setBusy(true); setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/sale-returns/settlements/${settlementId}/settle`, {
        method: "PATCH", headers,
        body: JSON.stringify({ amount: Number(draft.amount), paymentMethod: draft.method, effectiveAt: new Date(draft.date).toISOString() }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message || "No se pudo registrar el reembolso recibido.")
      setReceiptDrafts(values => ({ ...values, [settlementId]: { ...draft, amount: "" } }))
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al registrar reembolso.")
      refreshCapabilities()
    }
    finally { setBusy(false) }
  }

  if (sale.status !== "COMPLETED") return null

  return (
    <section className={styles.panel} aria-label="Devoluciones de esta venta">
      <div className={styles.heading}><RotateCcw size={16} aria-hidden="true" /><h3>Devoluciones de esta venta</h3></div>

      <section className={styles.newReturn} aria-labelledby="sale-new-return-heading">
        <div className={styles.returnHeading}>
          <strong id="sale-new-return-heading">Nueva devolución</strong>
          {loading && <Loader2 size={16} aria-label="Cargando historial" />}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Producto</th><th>Original</th><th>Devuelta</th><th>Restante</th><th>A devolver</th><th>Condición</th></tr></thead>
            <tbody>
              {lines.map(({ item, already, available }) => (
                <tr key={item.id}>
                  <td>
                    <span className={styles.productName} title={item.product.name}>{item.product.name}</span>
                    <span className={styles.productPrice}>{formatCurrency(item.unitPrice)} c/u</span>
                  </td>
                  <td className={styles.numeric}>{item.quantity}</td>
                  <td className={styles.numeric}>{already}</td>
                  <td className={styles.numeric}>{available}</td>
                  <td>
                    <input className={`${controls.control} ${styles.control}`} aria-label={`Cantidad a devolver: ${item.product.name}`} type="number" min="0" max={available} step={item.product.unitType === "UNIT" ? "1" : "0.001"} value={quantities[item.id] ?? ""} onChange={event => setQuantities(values => ({ ...values, [item.id]: event.target.value }))} />
                  </td>
                  <td>
                    <select className={`${controls.control} ${styles.control}`} aria-label={`Estado del producto: ${item.product.name}`} value={dispositions[item.id] || "RESTOCKABLE"} onChange={event => setDispositions(values => ({ ...values, [item.id]: event.target.value as "RESTOCKABLE" | "DAMAGED" }))}>
                      <option value="RESTOCKABLE">Apto para reventa</option><option value="DAMAGED">Dañado</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className={styles.formBlock} aria-labelledby="sale-return-reason-heading">
          <h4 id="sale-return-reason-heading" className={styles.blockTitle}>Motivo de devolución</h4>
          <label className={`${controls.label} ${styles.reasonField}`}>
            Descripción
            <input className={controls.control} maxLength={500} placeholder="Describí brevemente el motivo" value={reason} onChange={event => setReason(event.target.value)} />
          </label>
        </section>
        <section className={styles.formBlock} aria-labelledby="sale-return-finance-heading">
          <h4 id="sale-return-finance-heading" className={styles.blockTitle}>Resumen financiero</h4>
          <div className={styles.summary} aria-live="polite">
            <div><span>Importe a devolver</span><strong className={styles.summaryTotal}>{formatCurrency(returnTotal)}</strong></div>
            <div><span>Ajuste de deuda</span><strong>{formatCurrency(debtOffset)}</strong></div>
            <div><span>Excedente</span><strong>{formatCurrency(refund)}</strong></div>
          </div>
        </section>
        {refund > 0.01 && (
          <section className={styles.formBlock} aria-labelledby="sale-return-settlement-heading">
            <h4 id="sale-return-settlement-heading" className={styles.blockTitle}>Liquidación del excedente</h4>
            <label className={controls.label}>
              Destino
              <select className={controls.control} value={safeSettlement} onChange={event => setSettlement(event.target.value as typeof settlement)}>
                <option value="REFUND_PENDING">Registrar como reembolso pendiente</option>
                <option value="REFUND_CASH" disabled={!canRefundCash}>Entregar ahora en efectivo</option>
                <option value="REFUND_TRANSFER" disabled={!canSettleRefund}>Entregar ahora por transferencia</option>
              </select>
            </label>
            <p className={styles.helperText}>Seleccioná si el importe quedará pendiente o ya fue entregado al cliente.</p>
            {!canSettleRefund && refundCapability?.reason && <p className={styles.helperText} role="status">{refundCapability.reason} Podés registrar la devolución con el reembolso pendiente.</p>}
            {canSettleRefund && !activeCashSession && !cashSessionLoading && <p className={styles.helperText} role="status">Abrí una sesión de caja para habilitar la entrega inmediata en efectivo. La transferencia inmediata sigue disponible.</p>}
          </section>
        )}
        <div className={styles.confirmation}>
          {!canCreateReturn && <p className={styles.blockedNotice} role="status">{returnBlockMessage || "La devolución no está disponible temporalmente."}</p>}
          {capabilitiesError && <button type="button" className={styles.retryButton} onClick={refreshCapabilities}>Volver a verificar</button>}
          <button type="button" className={styles.primaryButton} disabled={busy || !selected.length || !canCreateReturn || capabilitiesLoading || !capabilities} aria-describedby={!canCreateReturn ? "sale-return-blocked-reason" : undefined} onClick={confirmReturn}>
            {busy ? "Procesando…" : "Confirmar devolución"}
          </button>
          {!canCreateReturn && <span id="sale-return-blocked-reason" className={styles.srOnly}>{returnBlockMessage}</span>}
        </div>
      </section>

      {error && <div className={styles.error} role="alert"><AlertCircle size={16} aria-hidden="true" />{error}</div>}
      <section className={styles.historySection} aria-labelledby="sale-return-history-heading">
        <div className={styles.returnHeading}><strong id="sale-return-history-heading">Devoluciones existentes</strong></div>
        {loading ? <p className={styles.muted}>Cargando historial…</p> : returns.length === 0 ? (
          <p className={styles.muted}>Esta venta todavía no tiene devoluciones.</p>
        ) : (
          <div className={styles.historyList}>
            {returns.map(row => (
              <article className={styles.returnCard} key={row.id}>
                <div className={styles.returnHeading}>
                  <strong>{row.status === "CONFIRMED" ? "Confirmada" : row.status === "CANCELLED" ? "Cancelada" : "Pendiente"}</strong>
                  <strong>{formatCurrency(row.total)}</strong>
                </div>
                <span className={styles.muted}>{new Date(row.returnDate).toLocaleDateString("es-PY")} · Deuda reducida {formatCurrency(row.debtOffsetAmount)}</span>
                <div className={styles.returnItems}>
                  {row.items.map((item, index) => <small key={`${row.id}-${index}`}>{item.product.name}: {item.quantity} · {item.disposition === "DAMAGED" ? "Dañado, no vendible" : "Apto para reventa"}</small>)}
                </div>
                {row.settlements.map(settlementRow => {
                  const received = settlementRow.receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0)
                  const pending = Math.max(0, Number(settlementRow.amount) - received)
                  const draft = receiptDrafts[settlementRow.id] || { amount: "", method: "TRANSFER" as const, date: toLocalDateTimeInput(new Date()) }
                  return (
                    <div className={styles.settlement} key={settlementRow.id}>
                      <div className={styles.financialRow}>
                        <span>Reembolso al cliente · {settlementRow.status}</span>
                        <strong>{formatCurrency(settlementRow.amount)} · Pendiente {formatCurrency(pending)}</strong>
                      </div>
                      {pending > 0.01 && (
                        <div className={styles.receiptForm}>
                          <label className={controls.label}>Importe
                            <input className={controls.control} type="number" min="0.01" max={pending} step="0.01" value={draft.amount} onChange={event => setReceiptDrafts(values => ({ ...values, [settlementRow.id]: { ...draft, amount: event.target.value } }))} />
                          </label>
                          <label className={controls.label}>Medio
                            <select className={controls.control} value={draft.method} onChange={event => setReceiptDrafts(values => ({ ...values, [settlementRow.id]: { ...draft, method: event.target.value as "CASH" | "TRANSFER" } }))}>
                              <option value="CASH" disabled={!activeCashSession || cashSessionLoading}>Efectivo</option><option value="TRANSFER">Transferencia</option>
                            </select>
                          </label>
                          <label className={controls.label}>Fecha efectiva
                            <input className={controls.control} type="datetime-local" value={draft.date} onChange={event => setReceiptDrafts(values => ({ ...values, [settlementRow.id]: { ...draft, date: event.target.value } }))} />
                          </label>
                          <button type="button" className={styles.primaryButton} disabled={busy || capabilitiesLoading || !canSettleRefund || (draft.method === "CASH" && (!activeCashSession || cashSessionLoading))} aria-describedby={!canSettleRefund ? `sale-refund-capability-${settlementRow.id}` : undefined} onClick={() => void registerReceipt(settlementRow.id)}>Registrar recepción</button>
                        </div>
                      )}
                      {!canSettleRefund && refundCapability?.reason && <p id={`sale-refund-capability-${settlementRow.id}`} className={styles.helperText}>{refundCapability.reason}</p>}
                      {draft.method === "CASH" && !activeCashSession && !cashSessionLoading && <p className={styles.helperText}>Abrí una sesión de caja para registrar un reembolso en efectivo.</p>}
                      <div className={styles.receiptList}>
                        {settlementRow.receipts.map((receipt, index) => <small key={`${settlementRow.id}-receipt-${index}`}>{formatCurrency(receipt.amount)} · {receipt.paymentMethod === "CASH" ? "Efectivo" : "Transferencia"} · {new Date(receipt.effectiveAt).toLocaleString("es-PY")}</small>)}
                      </div>
                    </div>
                  )
                })}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
