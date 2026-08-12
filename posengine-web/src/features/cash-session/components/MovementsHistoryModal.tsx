import { useState, useEffect, useMemo } from 'react'
import { X, ArrowUpRight, ArrowDownLeft, History, TrendingUp, TrendingDown, ListFilter } from 'lucide-react'
import styles from './MovementsHistoryModal.module.css'
import type { CashSession } from '../hooks/useCashSession'

interface Props {
  open: boolean
  session: CashSession | null
  onClose: () => void
}

type FilterType = 'ALL' | 'IN' | 'OUT'

const formatGs = (val: number) => `Gs. ${val.toLocaleString('es-PY')}`
const formatDateTime = (d: string) => new Date(d).toLocaleString('es-PY', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function MovementsHistoryModal({ open, session, onClose }: Props) {
  const [filter, setFilter] = useState<FilterType>('ALL')

  useEffect(() => {
    if (open) {
      setFilter('ALL')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, onClose])

  const movements = session?.movements ?? []

  const filteredMovements = useMemo(() => {
    if (filter === 'ALL') return movements
    return movements.filter((m: any) => m.type === filter)
  }, [movements, filter])

  const totals = useMemo(() => {
    let inf = 0
    let out = 0
    movements.forEach((m: any) => {
      if (m.type === 'IN') inf += m.amount
      else out += m.amount
    })
    return { inf, out, net: inf - out, count: movements.length }
  }, [movements])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrap}>
              <History size={16} />
            </div>
            <div>
              <h2 className={styles.title}>Historial de movimientos</h2>
              <p className={styles.subtitle}>
                Sesión actual · {totals.count} registrados
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Ingresos</span>
            <span className={`${styles.summaryValue} ${styles.positive}`}>
              + {formatGs(totals.inf)}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Egresos</span>
            <span className={`${styles.summaryValue} ${styles.negative}`}>
              − {formatGs(totals.out)}
            </span>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.filterRow}>
            <button
              className={`${styles.filterBtn} ${filter === 'ALL' ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter('ALL')}
              type="button"
            >
              <ListFilter size={14} /> Todos
            </button>
            <button
              className={`${styles.filterBtn} ${filter === 'IN' ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter('IN')}
              type="button"
            >
              <TrendingUp size={14} /> Ingresos
            </button>
            <button
              className={`${styles.filterBtn} ${filter === 'OUT' ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter('OUT')}
              type="button"
            >
              <TrendingDown size={14} /> Egresos
            </button>
          </div>

          {filteredMovements.length === 0 ? (
            <div className={styles.emptyState}>
              No hay movimientos{filter !== 'ALL' ? (filter === 'IN' ? ' de ingreso' : ' de egreso') : ''} registrados.
            </div>
          ) : (
            <div className={styles.movementsList}>
              {filteredMovements.map((m: any) => (
                <div key={m.id} className={styles.movementRow}>
                  <div className={styles.movementLeft}>
                    <div className={`${styles.movementIconWrap} ${m.type === 'IN' ? styles.movementIconIn : styles.movementIconOut}`}>
                      {m.type === 'IN' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                    </div>
                    <div className={styles.movementDetails}>
                      <span className={styles.movementDesc}>{m.description}</span>
                      <span className={styles.movementTime}>
                        {formatDateTime(m.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span className={`${styles.movementAmount} ${m.type === 'IN' ? styles.positive : styles.negative}`}>
                    {m.type === 'IN' ? '+' : '−'} {formatGs(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} type="button">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
