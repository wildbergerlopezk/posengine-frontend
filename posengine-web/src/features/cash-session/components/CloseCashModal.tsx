import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Lock, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import styles from './CloseCashModal.module.css'
import type { CashSession } from '../hooks/useCashSession'

interface Props {
  open: boolean
  session: CashSession | null
  loading: boolean
  onClose: () => void
  onConfirm: (closingAmount: number, notes?: string) => Promise<void>
}

function formatGs(val: number) {
  return `Gs. ${val.toLocaleString('es-PY')}`
}

function formatDisplay(val: string) {
  const num = val.replace(/\D/g, '')
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

interface ContentProps {
  session: CashSession
  loading: boolean
  onClose: () => void
  onConfirm: (closingAmount: number, notes?: string) => Promise<void>
}

type FinancialTone = 'neutral' | 'positive' | 'negative' | 'warning'

function FinancialRow({
  label,
  value,
  tone = 'neutral',
  emphasized = false,
}: {
  label: string
  value: string
  tone?: FinancialTone
  emphasized?: boolean
}) {
  return (
    <div className={`${styles.summaryRow} ${styles[`tone_${tone}`]} ${emphasized ? styles.summaryRowEmphasized : ''}`}>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  )
}

function CloseCashModalContent({
  session,
  loading,
  onClose,
  onConfirm,
}: ContentProps) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  const parsed = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
  const isAmountValid = !isNaN(parsed)
  const expected = session.expectedCashAmount ?? null
  const difference = isAmountValid && expected !== null ? parsed - expected : null

  const handleClose = async () => {
    if (!isAmountValid) {
      setError('Ingresá un monto válido')
      return
    }
    if (expected === null) {
      setError('No se puede cerrar: hay pagos con medio sin clasificar que requieren conciliación.')
      return
    }

    setError(null)
    try {
      await onConfirm(parsed, notes.trim() || undefined)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div data-pos-modal className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrap}>
              <Lock size={16} />
            </div>
            <div>
              <h2 className={styles.title}>Cierre de caja</h2>
              <p className={styles.subtitle}>Contá el efectivo físico y confirmá.</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button" disabled={loading}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.openingSummary}>
            <span className={styles.summaryLabel}>Monto inicial</span>
            <span className={styles.openingValue}>{formatGs(session.openingAmount)}</span>
          </div>

          <div className={styles.cashFlowGrid}>
            <section className={`${styles.summarySection} ${styles.inflowSection}`} aria-labelledby="cash-inflows-title">
              <h3 id="cash-inflows-title" className={styles.sectionTitle}>Entradas de efectivo</h3>
              <div className={styles.summaryRows}>
                <FinancialRow label="Ventas en efectivo" value={formatGs(session.totalPhysicalCashSales ?? 0)} tone="positive" />
                <FinancialRow label="Abonos de clientes" value={formatGs(session.totalCashDebtPayments ?? 0)} tone="positive" />
                <FinancialRow label="Ingresos manuales" value={formatGs(session.totalManualInflows ?? 0)} tone="positive" />
              </div>
            </section>

            <section className={`${styles.summarySection} ${styles.outflowSection}`} aria-labelledby="cash-outflows-title">
              <h3 id="cash-outflows-title" className={styles.sectionTitle}>Salidas de efectivo</h3>
              <div className={styles.summaryRows}>
                <FinancialRow label="Compras al contado" value={formatGs(session.totalCashPurchases ?? session.totalPurchases)} tone="negative" />
                <FinancialRow label="Pagos a proveedores" value={formatGs(session.totalCashPurchaseDebtPayments ?? 0)} tone="negative" />
                <FinancialRow label="Egresos manuales" value={formatGs(session.totalManualOutflows ?? 0)} tone="negative" />
              </div>
            </section>
          </div>

          <section className={`${styles.summarySection} ${styles.nonCashSection}`} aria-labelledby="non-cash-title">
            <h3 id="non-cash-title" className={styles.sectionTitle}>Operaciones que no afectan el efectivo</h3>
            <div className={styles.summaryRows}>
              <FinancialRow label="Ventas electrónicas" value={formatGs(session.totalElectronicSales ?? 0)} />
              <FinancialRow label="Abonos electrónicos" value={formatGs(session.totalElectronicDebtPayments ?? 0)} />
              <FinancialRow label="Ventas a crédito" value={formatGs(session.totalCreditSales ?? 0)} />
              <FinancialRow label="Compras a crédito" value={formatGs(session.totalCreditPurchases ?? 0)} />
              <FinancialRow label="Transferencias a proveedores" value={formatGs(session.totalElectronicPurchaseDebtPayments ?? 0)} />
            </div>
          </section>

          {((session.unclassifiedCustomerPayments ?? 0) > 0 || (session.unclassifiedSupplierPayments ?? 0) > 0) && (
            <section className={`${styles.summarySection} ${styles.pendingSection}`} aria-labelledby="pending-payments-title">
              <h3 id="pending-payments-title" className={styles.sectionTitle}>Conciliación pendiente</h3>
              <div className={styles.summaryRows}>
                {(session.unclassifiedCustomerPayments ?? 0) > 0 && (
                  <FinancialRow label="Abonos de clientes sin clasificar" value={formatGs(session.unclassifiedCustomerPayments ?? 0)} tone="warning" />
                )}
                {(session.unclassifiedSupplierPayments ?? 0) > 0 && (
                  <FinancialRow label="Pagos a proveedores sin clasificar" value={formatGs(session.unclassifiedSupplierPayments ?? 0)} tone="warning" />
                )}
              </div>
            </section>
          )}

          <div className={`${styles.summarySection} ${styles.resultSection}`}>
            <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
              <span className={styles.summaryLabel}>Efectivo esperado</span>
              <span className={`${styles.summaryValue} ${expected === null ? styles.pendingValue : styles.totalValue}`}>
                {expected === null ? 'Pendiente de conciliación' : formatGs(expected)}
              </span>
            </div>
          </div>

          {expected === null && (
            <p className={`${styles.errorMsg} ${styles.pendingWarning}`} role="alert">
              No se puede calcular el efectivo esperado hasta clasificar los pagos indicados.
            </p>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="closing-amount">
              Monto contado físicamente
              <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputWrap}>
              <span className={styles.prefix}>Gs.</span>
              <input
                ref={inputRef}
                id="closing-amount"
                type="text"
                inputMode="numeric"
                className={styles.input}
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  setError(null)
                  setAmount(formatDisplay(e.target.value))
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleClose()}
                disabled={loading}
              />
            </div>

            {isAmountValid && difference !== null && (
              <div className={`${styles.diffBadge} ${difference > 0 ? styles.diffPos : difference < 0 ? styles.diffNeg : styles.diffZero}`}>
                {difference > 0 ? <TrendingUp size={13} /> : difference < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                <span>
                  {difference === 0
                    ? 'Sin diferencia — perfecto'
                    : difference > 0
                    ? `Sobrante: ${formatGs(difference)}`
                    : `Faltante: ${formatGs(Math.abs(difference))}`}
                </span>
              </div>
            )}

            {error && <p className={styles.errorMsg}>{error}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="closing-notes">
              Observaciones <span className={styles.optional}>(opcional)</span>
            </label>
            <textarea
              id="closing-notes"
              className={styles.textarea}
              placeholder="Ej: Todo en orden al cierre"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
              rows={2}
              disabled={loading}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerRight}>
            <button className={styles.cancelBtn} onClick={onClose} disabled={loading} type="button">
              Cancelar
            </button>
            <button
              className={styles.confirmBtn}
              onClick={handleClose}
              disabled={loading || !isAmountValid || expected === null}
              type="button"
            >
              {loading ? (
                <><Loader2 size={15} className={styles.spinner} /> Cerrando...</>
              ) : (
                <>Cerrar caja</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CloseCashModal({
  open,
  session,
  loading,
  onClose,
  onConfirm,
}: Props) {
  if (!open || !session) return null

  return (
    <CloseCashModalContent
      session={session}
      loading={loading}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
