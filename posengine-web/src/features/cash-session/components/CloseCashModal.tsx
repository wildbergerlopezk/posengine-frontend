import { useState, useEffect, useRef } from 'react'
import {
  X,
  Loader2,
  Lock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import styles from './CloseCashModal.module.css'
import type { CashSession } from '../hooks/useCashSession'

interface Props {
  open: boolean
  session: CashSession | null
  loading: boolean
  onClose: () => void
  onConfirm: (closingAmount: number, notes?: string) => Promise<void>
  onForceClose: (
    closingAmount: number,
    confirmation: string,
    forceReason?: string,
  ) => Promise<void>
  blockingError?: string | null // error del backend (tiempo, sin ventas)
}

type Step = 'summary' | 'force-warn' | 'force-confirm'

function formatGs(val: number) {
  return `Gs. ${val.toLocaleString('es-PY')}`
}

function formatDisplay(val: string) {
  const num = val.replace(/\D/g, '')
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function CloseCashModal({
  open,
  session,
  loading,
  onClose,
  onConfirm,
  onForceClose,
  blockingError,
}: Props) {
  const [step, setStep] = useState<Step>('summary')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [forceReason, setForceReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setStep('summary')
    setAmount('')
    setNotes('')
    setForceReason('')
    setConfirmation('')
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (step === 'summary') onClose()
        else setStep('summary')
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, step, onClose])

  if (!open || !session) return null

  const parsed = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
  const isAmountValid = !isNaN(parsed) && parsed >= 0

  const expected = session.openingAmount + session.totalSales - session.totalPurchases
  const difference = isAmountValid ? parsed - expected : null
  const canConfirmForce = confirmation === 'CERRAR' && isAmountValid

  const handleClose = async () => {
    if (!isAmountValid) { setError('Ingresá un monto válido'); return }
    setError(null)
    try {
      await onConfirm(parsed, notes.trim() || undefined)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleForceClose = async () => {
    if (!canConfirmForce) return
    setError(null)
    try {
      await onForceClose(parsed, 'CERRAR', forceReason.trim() || undefined)
    } catch (err: any) {
      setError(err.message)
    }
  }

  // ── STEP: summary ──────────────────────────────────────────────────────────
  if (step === 'summary') {
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
                <p className={styles.subtitle}>Contá el efectivo físico y confirmá</p>
              </div>
            </div>
            <button className={styles.closeBtn} onClick={onClose} type="button" disabled={loading}>
              <X size={16} />
            </button>
          </div>

          <div className={styles.body}>
            {/* Resumen del día */}
            <div className={styles.summaryCard}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Monto inicial</span>
                <span className={styles.summaryValue}>{formatGs(session.openingAmount)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>+ Ventas del día</span>
                <span className={`${styles.summaryValue} ${styles.positive}`}>{formatGs(session.totalSales)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>− Compras del día</span>
                <span className={`${styles.summaryValue} ${styles.negative}`}>{formatGs(session.totalPurchases)}</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span className={styles.summaryLabel}>Efectivo esperado</span>
                <span className={`${styles.summaryValue} ${styles.totalValue}`}>{formatGs(expected)}</span>
              </div>
            </div>

            {/* Input monto contado */}
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

              {/* Diferencia en tiempo real */}
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

              {error && !blockingError && <p className={styles.errorMsg}>{error}</p>}
            </div>

            {/* Error de validación del backend (tiempo, ventas) */}
            {(blockingError || error) && (
              <div className={styles.blockError}>
                <AlertTriangle size={14} />
                <span>{blockingError ?? error}</span>
              </div>
            )}

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
            <button
              className={styles.forceBtn}
              type="button"
              onClick={() => setStep('force-warn')}
              disabled={loading}
            >
              Forzar cierre
            </button>
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

  // ── STEP: force-warn ───────────────────────────────────────────────────────
  if (step === 'force-warn') {
    return (
      <div className={styles.overlay} onClick={() => setStep('summary')}>
        <div className={`${styles.modal} ${styles.modalWarn}`} onClick={(e) => e.stopPropagation()}>

          <div className={`${styles.header} ${styles.headerWarn}`}>
            <div className={styles.headerLeft}>
              <div className={`${styles.iconWrap} ${styles.iconWrapWarn}`}>
                <AlertTriangle size={16} />
              </div>
              <div>
                <h2 className={styles.title}>Forzar cierre de caja</h2>
                <p className={styles.subtitle}>Esta acción tiene consecuencias importantes</p>
              </div>
            </div>
            <button className={styles.closeBtn} onClick={() => setStep('summary')} type="button">
              <X size={16} />
            </button>
          </div>

          <div className={styles.body}>
            <div className={styles.warnBox}>
              <p className={styles.warnTitle}>⚠️ Estás a punto de forzar el cierre de caja ignorando las advertencias del sistema.</p>
              <p className={styles.warnSubtitle}>Al confirmar esta acción:</p>
              <ul className={styles.warnList}>
                <li>No podrás abrir la caja nuevamente hoy</li>
                <li>No podrás registrar ventas por el resto del día</li>
                <li>El resumen del día quedará incompleto</li>
                <li>Esta acción quedará registrada en el historial</li>
              </ul>
            </div>
          </div>

          <div className={styles.footer}>
            <button className={styles.backBtn} type="button" onClick={() => setStep('summary')}>
              <ArrowLeft size={14} /> Volver
            </button>
            <button
              className={styles.warnContinueBtn}
              type="button"
              onClick={() => setStep('force-confirm')}
            >
              Sí, quiero forzar el cierre <ChevronRight size={14} />
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ── STEP: force-confirm ────────────────────────────────────────────────────
  return (
    <div className={styles.overlay} onClick={() => setStep('force-warn')}>
      <div className={`${styles.modal} ${styles.modalWarn}`} onClick={(e) => e.stopPropagation()}>

        <div className={`${styles.header} ${styles.headerWarn}`}>
          <div className={styles.headerLeft}>
            <div className={`${styles.iconWrap} ${styles.iconWrapWarn}`}>
              <AlertTriangle size={16} />
            </div>
            <div>
              <h2 className={styles.title}>Confirmar cierre forzado</h2>
              <p className={styles.subtitle}>Escribí CERRAR para confirmar</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={() => setStep('force-warn')} type="button">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fc-amount">
              Monto contado físicamente <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputWrap}>
              <span className={styles.prefix}>Gs.</span>
              <input
                id="fc-amount"
                type="text"
                inputMode="numeric"
                className={styles.input}
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  setError(null)
                  setAmount(formatDisplay(e.target.value))
                }}
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="force-reason">
              Motivo del cierre forzado <span className={styles.optional}>(opcional)</span>
            </label>
            <textarea
              id="force-reason"
              className={styles.textarea}
              placeholder="Ej: Necesito cerrar antes de tiempo por emergencia..."
              value={forceReason}
              onChange={(e) => setForceReason(e.target.value)}
              maxLength={300}
              rows={2}
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirmation-input">
              Escribí <strong>CERRAR</strong> para confirmar
            </label>
            <input
              id="confirmation-input"
              type="text"
              className={`${styles.input} ${styles.inputConfirm} ${confirmation === 'CERRAR' ? styles.inputConfirmOk : ''}`}
              style={{ height: '2.5rem', paddingLeft: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--color-border)', background: 'var(--color-background)', width: '100%' }}
              placeholder="CERRAR"
              value={confirmation}
              onChange={(e) => { setError(null); setConfirmation(e.target.value.toUpperCase()) }}
              onKeyDown={(e) => e.key === 'Enter' && canConfirmForce && handleForceClose()}
              disabled={loading}
              autoFocus
            />
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}
        </div>

        <div className={styles.footer}>
          <button className={styles.backBtn} type="button" onClick={() => setStep('force-warn')} disabled={loading}>
            <ArrowLeft size={14} /> Volver
          </button>
          <button
            className={styles.forceConfirmBtn}
            type="button"
            onClick={handleForceClose}
            disabled={!canConfirmForce || loading}
          >
            {loading ? (
              <><Loader2 size={15} className={styles.spinner} /> Cerrando...</>
            ) : (
              <>Sí, cerrar de todas formas</>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
