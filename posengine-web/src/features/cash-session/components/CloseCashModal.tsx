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

function CloseCashModalContent({
  session,
  loading,
  onClose,
  onConfirm,
}: Omit<Props, 'open'>) {
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
  const expected = session.openingAmount + session.totalSales - session.totalPurchases
  const difference = isAmountValid ? parsed - expected : null

  const handleClose = async () => {
    if (!isAmountValid) {
      setError('Ingresá un monto válido')
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
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
          <div className={styles.summaryCard}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Monto inicial</span>
              <span className={styles.summaryValue}>{formatGs(session.openingAmount)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>+ Ventas del día</span>
              <span className={`${styles.summaryValue} ${styles.positive}`}>
                {formatGs(session.totalSales)}
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>− Compras del día</span>
              <span className={`${styles.summaryValue} ${styles.negative}`}>
                {formatGs(session.totalPurchases)}
              </span>
            </div>
            <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
              <span className={styles.summaryLabel}>Efectivo esperado</span>
              <span className={`${styles.summaryValue} ${styles.totalValue}`}>
                {formatGs(expected)}
              </span>
            </div>
          </div>

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
              disabled={loading || !isAmountValid}
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
