import { useState, useEffect, useRef } from 'react'
import { X, DollarSign, Loader2, Wallet } from 'lucide-react'
import styles from './OpenCashModal.module.css'

interface Props {
  open: boolean
  loading: boolean
  onConfirm: (openingAmount: number, notes?: string) => Promise<void>
  onClose: () => void
}

export function OpenCashModal({ open, loading, onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setAmount('')
    setNotes('')
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, onClose])

  if (!open) return null

  const parsed = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
  const isValid = !isNaN(parsed) && parsed >= 0

  const handleSubmit = async () => {
    if (!isValid) { setError('Ingresá un monto válido (puede ser 0)'); return }
    setError(null)
    try {
      await onConfirm(parsed, notes.trim() || undefined)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const formatDisplay = (val: string) => {
    const num = val.replace(/\D/g, '')
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrap}>
              <Wallet size={18} />
            </div>
            <div>
              <h2 className={styles.title}>Apertura de caja</h2>
              <p className={styles.subtitle}>Contá el efectivo antes de empezar</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button" disabled={loading}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="opening-amount">
              Monto inicial en caja
              <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputWrap}>
              <span className={styles.prefix}>Gs.</span>
              <input
                ref={inputRef}
                id="opening-amount"
                type="text"
                inputMode="numeric"
                className={styles.input}
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  setError(null)
                  setAmount(formatDisplay(e.target.value))
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                disabled={loading}
              />
            </div>
            {error && <p className={styles.errorMsg}>{error}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="opening-notes">
              Observaciones <span className={styles.optional}>(opcional)</span>
            </label>
            <textarea
              id="opening-notes"
              className={styles.textarea}
              placeholder="Ej: Apertura turno mañana, dinero de caja chica..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
              rows={2}
              disabled={loading}
            />
            <span className={styles.charCount}>{notes.length}/300</span>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={loading} type="button">
            Cancelar
          </button>
          <button
            className={styles.confirmBtn}
            onClick={handleSubmit}
            disabled={loading}
            type="button"
          >
            {loading ? (
              <><Loader2 size={15} className={styles.spinner} /> Abriendo...</>
            ) : (
              <>Abrir caja</>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
