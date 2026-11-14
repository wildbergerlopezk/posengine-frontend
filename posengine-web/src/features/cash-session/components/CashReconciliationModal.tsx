import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, RefreshCw, X } from 'lucide-react'
import { ConfirmDialog } from '@/src/shared/components/ConfirmDialog'
import type { ReconciliationMethod, ReconciliationPayment, ReconciliationResponse } from '../hooks/useCashSession'
import styles from './CashReconciliationModal.module.css'

interface Props {
  open: boolean
  onClose: () => void
  loadItems: () => Promise<ReconciliationResponse>
  onClassify: (type: 'CUSTOMER' | 'SUPPLIER', paymentId: string, method: ReconciliationMethod, reason: string) => Promise<unknown>
}

type Draft = { method: ReconciliationMethod | ''; reason: string }
type SelectedPayment = { type: 'CUSTOMER' | 'SUPPLIER'; item: ReconciliationPayment; draft: Draft }

const formatMoney = (value: number | string) => `Gs. ${Number(value).toLocaleString('es-PY')}`
const formatDate = (value: string) => new Date(value).toLocaleString('es-PY', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function CashReconciliationModal({ open, onClose, loadItems, onClassify }: Props) {
  const [data, setData] = useState<ReconciliationResponse | null>(null)
  const [activeType, setActiveType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER')
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [selected, setSelected] = useState<SelectedPayment | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await loadItems())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los pagos pendientes.')
    } finally {
      setLoading(false)
    }
  }, [loadItems])

  useEffect(() => {
    if (open) {
      setActiveType('CUSTOMER')
      setDrafts({})
      void refresh()
    }
  }, [open, refresh])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !selected && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, selected, saving])

  const items = activeType === 'CUSTOMER' ? data?.customers ?? [] : data?.suppliers ?? []
  const selectedKey = (type: string, id: string) => `${type}:${id}`
  const counts = useMemo(() => ({
    customers: data?.customers.length ?? 0,
    suppliers: data?.suppliers.length ?? 0,
  }), [data])

  const confirmClassification = async () => {
    if (!selected || !selected.draft.method || selected.draft.reason.trim().length < 3) return
    setSaving(true)
    setError(null)
    try {
      await onClassify(selected.type, selected.item.id, selected.draft.method, selected.draft.reason.trim())
      setDrafts((current) => {
        const next = { ...current }
        delete next[selectedKey(selected.type, selected.item.id)]
        return next
      })
      setSelected(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo clasificar el pago.')
      setSelected(null)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="cash-reconciliation-title">
          <header className={styles.header}>
            <div>
              <h2 id="cash-reconciliation-title">Conciliación de caja</h2>
              <p>Revisá cada pago y confirmá el medio realmente utilizado.</p>
            </div>
            <div className={styles.headerActions}>
              <button className={styles.iconButton} type="button" onClick={() => void refresh()} aria-label="Actualizar pagos pendientes" disabled={loading}>
                <RefreshCw size={16} />
              </button>
              <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Cerrar conciliación">
                <X size={18} />
              </button>
            </div>
          </header>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <nav className={styles.tabs} aria-label="Tipo de pago pendiente">
            <button type="button" className={activeType === 'CUSTOMER' ? styles.activeTab : ''} onClick={() => setActiveType('CUSTOMER')}>
              Abonos de clientes <span>{counts.customers}</span>
            </button>
            <button type="button" className={activeType === 'SUPPLIER' ? styles.activeTab : ''} onClick={() => setActiveType('SUPPLIER')}>
              Pagos a proveedores <span>{counts.suppliers}</span>
            </button>
          </nav>

          <div className={styles.list} aria-live="polite">
            {loading ? (
              <p className={styles.status}>Cargando pagos pendientes…</p>
            ) : items.length === 0 ? (
              <p className={styles.status}>No hay pagos pendientes en esta categoría.</p>
            ) : items.map((item) => {
              const draftKey = selectedKey(item.type, item.id)
              const draft = drafts[draftKey] ?? { method: '', reason: '' }
              const person = item.type === 'CUSTOMER' ? item.customer?.name : item.supplier?.name
              const methods: ReconciliationMethod[] = item.type === 'CUSTOMER'
                ? ['CASH', 'TRANSFER', 'CARD']
                : ['CASH', 'TRANSFER']
              return (
                <article className={styles.payment} key={draftKey}>
                  <div className={styles.paymentHeading}>
                    <div>
                      <strong>{person ?? (item.type === 'CUSTOMER' ? 'Cliente sin nombre' : 'Proveedor sin nombre')}</strong>
                      <span>{item.reference} · {formatDate(item.date)}</span>
                    </div>
                    <strong className={styles.amount}>{formatMoney(item.amount)}</strong>
                  </div>
                  <div className={styles.currentMethod}>Medio actual: <b>{item.paymentMethod ?? 'Sin clasificar'}</b></div>
                  {!item.canClassify ? (
                    <div className={styles.blocked}><AlertCircle size={15} /> {item.reason ?? 'Este pago requiere revisión administrativa.'}</div>
                  ) : (
                    <div className={styles.formRow}>
                      <label>
                        Medio real
                        <select
                          value={draft.method}
                          onChange={(event) => setDrafts((current) => ({
                            ...current,
                            [draftKey]: { ...draft, method: event.target.value as ReconciliationMethod | '' },
                          }))}
                        >
                          <option value="">Seleccionar medio…</option>
                          {methods.map((method) => <option key={method} value={method}>{method === 'CASH' ? 'Efectivo' : method === 'TRANSFER' ? 'Transferencia' : 'Tarjeta'}</option>)}
                        </select>
                      </label>
                      <label className={styles.reasonField}>
                        Motivo / observación
                        <input
                          value={draft.reason}
                          maxLength={500}
                          placeholder="Ej.: comprobante verificado"
                          onChange={(event) => setDrafts((current) => ({
                            ...current,
                            [draftKey]: { ...draft, reason: event.target.value },
                          }))}
                        />
                      </label>
                      <button
                        className={styles.classifyButton}
                        type="button"
                        disabled={!draft.method || draft.reason.trim().length < 3}
                        onClick={() => setSelected({ type: item.type, item, draft })}
                      >
                        Clasificar
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          <footer className={styles.footer}>
            <span>La conciliación cambia solo el medio del pago existente.</span>
            <button className={styles.closeButton} type="button" onClick={onClose}>Cerrar</button>
          </footer>
        </section>
      </div>
      <ConfirmDialog
        open={Boolean(selected)}
        title="Confirmar clasificación"
        message={selected ? `Vas a clasificar ${formatMoney(selected.item.amount)} como ${selected.draft.method}. No se modificará el importe ni la deuda.` : ''}
        confirmText="Confirmar"
        cancelText="Volver"
        type="warning"
        loading={saving}
        onCancel={() => !saving && setSelected(null)}
        onConfirm={() => void confirmClassification()}
      />
    </>
  )
}
