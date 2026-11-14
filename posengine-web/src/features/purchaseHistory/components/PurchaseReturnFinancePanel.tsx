"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, Wallet } from "lucide-react"
import { API_BASE_URL } from "@/src/shared/config/api"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { useCommercialCapabilities } from "@/src/shared/hooks/useCommercialCapabilities"
import controls from "@/src/shared/styles/detailFormControls.module.css"
import styles from "./PurchaseReturnFinancePanel.module.css"

type Receipt = {
  id: string
  amount: number
  paymentMethod: "CASH" | "TRANSFER"
  effectiveAt: string
  reference?: string | null
  notes?: string | null
}

type Settlement = {
  id: string
  type: "REFUND" | "SUPPLIER_CREDIT"
  status: "PENDING" | "PARTIALLY_SETTLED" | "SETTLED" | "PARTIALLY_APPLIED" | "APPLIED"
  amount: number
  appliedAmount: number
  receipts: Receipt[]
  applications: Array<{ id: string; purchaseId: string; amount: number; createdAt: string }>
}

type PurchaseReturn = {
  id: string
  returnDate: string
  reason?: string | null
  total: number
  debtAdjustments: Array<{ amount: number }>
  settlements: Settlement[]
  purchase: { invoiceNumber: string }
}

interface Props {
  purchaseId: string
  supplierId: string
  supplierName: string
  purchaseNumber: string
  paymentType: "CASH" | "CREDIT"
  debtBalance: number
  cashSessionId?: string
  accessToken: string
  onCreditApplied: () => void
}

export function PurchaseReturnFinancePanel(props: Props) {
  const headers = useMemo(() => ({ "Content-Type": "application/json", Authorization: `Bearer ${props.accessToken}` }), [props.accessToken])
  const { capabilities, loading: capabilitiesLoading, error: capabilitiesError, refresh: refreshCapabilities } = useCommercialCapabilities(props.accessToken)
  const [returns, setReturns] = useState<PurchaseReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [receiptAmounts, setReceiptAmounts] = useState<Record<string, string>>({})
  const [receiptMethods, setReceiptMethods] = useState<Record<string, "CASH" | "TRANSFER">>({})
  const [receiptDates, setReceiptDates] = useState<Record<string, string>>({})
  const [receiptReferences, setReceiptReferences] = useState<Record<string, string>>({})
  const [receiptNotes, setReceiptNotes] = useState<Record<string, string>>({})
  const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({})
  const settlementCapability = capabilities?.purchaseReturnSettlements
  const creditCapability = capabilities?.supplierCreditApplications

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ supplierId: props.supplierId })
      const response = await fetch(`${API_BASE_URL}/purchase-returns?${params}`, { headers })
      if (!response.ok) throw new Error("No se pudo cargar el historial financiero del proveedor.")
      setReturns(await response.json())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al cargar devoluciones.")
    } finally {
      setLoading(false)
    }
  }, [props.supplierId, headers])

  useEffect(() => { void fetchReturns() }, [fetchReturns])

  const recordReceipt = async (settlement: Settlement) => {
    const amount = Number(receiptAmounts[settlement.id])
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingresá un importe de reembolso mayor que cero.")
      return
    }
    if (settlementCapability?.enabled !== true) {
      setError(settlementCapability?.reason || capabilitiesError || "La liquidación no está disponible temporalmente.")
      return
    }
    const paymentMethod = receiptMethods[settlement.id] ?? "TRANSFER"
    if (paymentMethod === "CASH" && !props.cashSessionId) {
      setError("Abrí una caja antes de registrar un reembolso en efectivo.")
      return
    }
    setSavingId(settlement.id)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${API_BASE_URL}/purchase-returns/settlements/${settlement.id}/settle`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          amount,
          paymentMethod,
          effectiveAt: receiptDates[settlement.id] ? new Date(`${receiptDates[settlement.id]}T12:00:00`).toISOString() : new Date().toISOString(),
          reference: receiptReferences[settlement.id]?.trim() || undefined,
          notes: receiptNotes[settlement.id]?.trim() || undefined,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || "No se pudo registrar el reembolso.")
      setNotice("Reembolso registrado; se actualizó el saldo pendiente.")
      setReceiptAmounts((current) => ({ ...current, [settlement.id]: "" }))
      await fetchReturns()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al registrar el reembolso.")
      refreshCapabilities()
    } finally {
      setSavingId(null)
    }
  }

  const applyCredit = async (settlement: Settlement) => {
    const amount = Number(creditAmounts[settlement.id])
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingresá el importe del crédito que querés aplicar.")
      return
    }
    if (creditCapability?.enabled !== true) {
      setError(creditCapability?.reason || capabilitiesError || "La aplicación de créditos no está disponible temporalmente.")
      return
    }
    setSavingId(settlement.id)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${API_BASE_URL}/purchase-returns/settlements/${settlement.id}/apply-credit`, {
        method: "POST",
        headers,
        body: JSON.stringify({ purchaseId: props.purchaseId, amount }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || "No se pudo aplicar el crédito.")
      setNotice(`Crédito aplicado a la compra ${props.purchaseNumber}.`)
      setCreditAmounts((current) => ({ ...current, [settlement.id]: "" }))
      await Promise.all([fetchReturns(), props.onCreditApplied()])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al aplicar el crédito.")
      refreshCapabilities()
    } finally {
      setSavingId(null)
    }
  }

  const supplierReturns = returns.filter((entry) => entry.settlements.length > 0)

  return (
    <section className={styles.panel} aria-label="Liquidaciones de devoluciones de compras">
      <header className={styles.header}>
        <div>
          <h3>Historial de devoluciones</h3>
          <p>Factura {props.purchaseNumber} · {props.supplierName}</p>
        </div>
        <button type="button" onClick={() => void fetchReturns()} disabled={loading || savingId !== null} aria-label="Actualizar devoluciones">
          {loading ? <Loader2 size={16} className={styles.spin} /> : "Actualizar"}
        </button>
      </header>
      {error && <div className={styles.error} role="alert"><AlertCircle size={16} />{error}</div>}
      {notice && <div className={styles.notice} role="status"><CheckCircle2 size={16} />{notice}</div>}
      {capabilitiesError && <div className={styles.notice} role="status">{capabilitiesError}</div>}
      {loading ? <p className={styles.empty}>Cargando liquidaciones…</p> : supplierReturns.length === 0 ? (
        <p className={styles.empty}>Esta compra todavía no tiene devoluciones con saldos financieros.</p>
      ) : supplierReturns.map((entry) => (
        <article key={entry.id} className={styles.returnCard}>
          <div className={styles.returnHeading}>
            <div><strong>Factura {entry.purchase.invoiceNumber}</strong><span>Devolución {new Date(entry.returnDate).toLocaleDateString("es-PY")}</span></div>
            <strong>{formatCurrency(entry.total)}</strong>
          </div>
          <div className={styles.summary}>
            <span>Reducción de deuda</span><strong>{formatCurrency(entry.debtAdjustments.reduce((sum, row) => sum + Number(row.amount), 0))}</strong>
          </div>
          {entry.settlements.map((settlement) => {
            const receipts = settlement.receipts ?? []
            const received = receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0)
            const refundDue = Math.max(0, Number(settlement.amount) - received)
            const creditAvailable = Math.max(0, Number(settlement.amount) - Number(settlement.appliedAmount))
            return (
              <div key={settlement.id} className={styles.settlement}>
                <div className={styles.summary}>
                  <span>{settlement.type === "REFUND" ? "Reembolso por recibir" : "Crédito del proveedor"}</span>
                  <strong>{formatCurrency(settlement.amount)}</strong>
                </div>
                {settlement.type === "REFUND" ? (
                  <>
                    <div className={styles.summary}><span>Recibido</span><strong>{formatCurrency(received)} · Pendiente {formatCurrency(refundDue)}</strong></div>
                    {receipts.map((receipt) => <p className={styles.history} key={receipt.id}>{formatCurrency(receipt.amount)} · {receipt.paymentMethod === "CASH" ? "Efectivo" : "Transferencia"} · {new Date(receipt.effectiveAt).toLocaleString("es-PY")}{receipt.reference ? ` · ${receipt.reference}` : ""}</p>)}
                    {refundDue > 0 && (
                      <div className={styles.form}>
                        <label>Importe recibido<input className={controls.control} type="number" min="0.01" max={refundDue} step="0.01" value={receiptAmounts[settlement.id] ?? ""} onChange={(event) => setReceiptAmounts((current) => ({ ...current, [settlement.id]: event.target.value }))} /></label>
                        <label>Medio<select className={controls.control} value={receiptMethods[settlement.id] ?? "TRANSFER"} onChange={(event) => setReceiptMethods((current) => ({ ...current, [settlement.id]: event.target.value as "CASH" | "TRANSFER" }))}><option value="TRANSFER">Transferencia</option><option value="CASH" disabled={!props.cashSessionId}>Efectivo</option></select></label>
                        <label>Fecha efectiva<input className={controls.control} type="date" value={receiptDates[settlement.id] ?? new Date().toISOString().slice(0, 10)} onChange={(event) => setReceiptDates((current) => ({ ...current, [settlement.id]: event.target.value }))} /></label>
                        <label>Referencia<input className={controls.control} maxLength={120} value={receiptReferences[settlement.id] ?? ""} onChange={(event) => setReceiptReferences((current) => ({ ...current, [settlement.id]: event.target.value }))} /></label>
                        <label className={styles.wide}>Observación<input className={controls.control} maxLength={500} value={receiptNotes[settlement.id] ?? ""} onChange={(event) => setReceiptNotes((current) => ({ ...current, [settlement.id]: event.target.value }))} /></label>
                        <button type="button" disabled={savingId !== null || capabilitiesLoading || !capabilities || settlementCapability?.enabled !== true || (receiptMethods[settlement.id] === "CASH" && !props.cashSessionId)} aria-describedby={settlementCapability?.enabled === false ? `purchase-settlement-reason-${settlement.id}` : undefined} onClick={() => void recordReceipt(settlement)}>{savingId === settlement.id ? <Loader2 size={15} className={styles.spin} /> : <Wallet size={15} />} Registrar reembolso</button>
                        {settlementCapability?.enabled === false && <p id={`purchase-settlement-reason-${settlement.id}`} className={styles.helperText}>{settlementCapability.reason}</p>}
                        {receiptMethods[settlement.id] === "CASH" && !props.cashSessionId && <p className={styles.helperText}>Abrí una sesión de caja para registrar un reembolso en efectivo.</p>}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className={styles.summary}><span>Aplicado / disponible</span><strong>{formatCurrency(settlement.appliedAmount)} / {formatCurrency(creditAvailable)}</strong></div>
                    {settlement.applications.map((application) => <p className={styles.history} key={application.id}>{formatCurrency(application.amount)} · Compra {application.purchaseId} · {new Date(application.createdAt).toLocaleDateString("es-PY")}</p>)}
                    {props.paymentType === "CREDIT" && props.debtBalance > 0 && creditAvailable > 0 && (
                      <div className={styles.form}>
                        <label>Aplicar a factura {props.purchaseNumber}<input className={controls.control} type="number" min="0.01" max={Math.min(props.debtBalance, creditAvailable)} step="0.01" value={creditAmounts[settlement.id] ?? ""} onChange={(event) => setCreditAmounts((current) => ({ ...current, [settlement.id]: event.target.value }))} /></label>
                        <span>Deuda pendiente: {formatCurrency(props.debtBalance)}</span>
                        <button type="button" disabled={savingId !== null || capabilitiesLoading || !capabilities || creditCapability?.enabled !== true} aria-describedby={creditCapability?.enabled === false ? `purchase-credit-reason-${settlement.id}` : undefined} onClick={() => void applyCredit(settlement)}>{savingId === settlement.id ? <Loader2 size={15} className={styles.spin} /> : <CheckCircle2 size={15} />} Aplicar crédito</button>
                        {creditCapability?.enabled === false && <p id={`purchase-credit-reason-${settlement.id}`} className={styles.helperText}>{creditCapability.reason}</p>}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </article>
      ))}
    </section>
  )
}
