import { useState, useEffect, useRef } from 'react'
import { X, Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import styles from './AddMovementModal.module.css'

interface Props {
  open: boolean
  loading: boolean
  onConfirm: (amount: number, type: 'IN' | 'OUT', description: string) => Promise<void>
  onClose: () => void
}

export function AddMovementModal({ open, loading, onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'IN' | 'OUT'>('OUT')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setAmount('')
    setType('OUT')
    setDescription('')
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
  const isValid = !isNaN(parsed) && parsed > 0

  const handleSubmit = async () => {
    if (!isValid) { setError('Ingresá un monto mayor a 0'); return }
    if (!description.trim()) { setError('Ingresá un motivo o descripción'); return }
    setError(null)
    try {
      await onConfirm(parsed, type, description.trim())
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
              {type === 'IN' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
            </div>
            <div>
              <h2 className={styles.title}>Movimiento manual de caja</h2>
              <p className={styles.subtitle}>Registrá un ingreso o egreso de efectivo</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button" disabled={loading}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Tipo de movimiento */}
          <div className={styles.field}>
            <label className={styles.label}>Tipo de movimiento</label>
            <div className={styles.typeSelector}>
              <button
                type="button"
                className={`${styles.typeBtn} ${type === 'OUT' ? styles.typeBtnActiveOut : ''}`}
                onClick={() => setType('OUT')}
                disabled={loading}
              >
                <ArrowDownLeft size={16} /> Egreso / Retiro
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${type === 'IN' ? styles.typeBtnActiveIn : ''}`}
                onClick={() => setType('IN')}
                disabled={loading}
              >
                <ArrowUpRight size={16} /> Ingreso / Entrada
              </button>
            </div>
          </div>

          {/* Monto */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="movement-amount">
              Monto
              <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputWrap}>
              <span className={styles.prefix}>Gs.</span>
              <input
                ref={inputRef}
                id="movement-amount"
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
          </div>

          {/* Descripción */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="movement-desc">
              Descripción / Motivo
              <span className={styles.required}>*</span>
            </label>
            <textarea
              id="movement-desc"
              className={styles.textarea}
              placeholder="Ej: Retiro para sencillo de caja, pago de delivery, etc..."
              value={description}
              onChange={(e) => {
                setError(null)
                setDescription(e.target.value)
              }}
              maxLength={300}
              rows={2}
              disabled={loading}
            />
            <span className={styles.charCount}>{description.length}/300</span>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}
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
              <><Loader2 size={15} className={styles.spinner} /> Registrando...</>
            ) : (
              <>Registrar</>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
