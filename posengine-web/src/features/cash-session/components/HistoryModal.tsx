import { useState, useEffect, useRef, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, Loader2, Calendar, Unlock, Lock, AlertTriangle, Clock } from 'lucide-react'
import { useCashHistory } from '../hooks/useCashHistory'
import type { CashSession } from '../hooks/useCashSession'
import styles from './HistoryModal.module.css'

interface Props {
  open: boolean
  loading?: boolean
  onClose: () => void
}

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function formatGs(val?: number | null) {
  if (val == null) {
    return 'Gs. 0'
  }
  return `Gs. ${val.toLocaleString('es-PY')}`
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
}

export function HistoryModal({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [hoveredSession, setHoveredSession] = useState<CashSession | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const { sessions, loading, error, fetchHistory } = useCashHistory()

  // Fetch history when month changes
  useEffect(() => {
    if (open) {
      fetchHistory(currentYear, currentMonth + 1) // API expects 1-indexed month
    }
  }, [open, currentYear, currentMonth, fetchHistory])

  // Close on Escape
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

  // Map sessions by day-of-month for quick lookup
  const sessionsByDay = useMemo(() => {
    const map = new Map<number, CashSession>()
    sessions.forEach((s) => {
      const d = new Date(s.openedAt).getDate()
      map.set(d, s)
    })
    return map
  }, [sessions])

  // Calendar grid helpers
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  // getDay(): 0=Sun … 6=Sat  →  we want Mon=0, so shift
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    const isCurrentMonth =
      currentYear === today.getFullYear() && currentMonth === today.getMonth()
    if (isCurrentMonth) return // don't go past current month
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const isNextDisabled =
    currentYear === today.getFullYear() && currentMonth === today.getMonth()

  const handleCellHover = (session: CashSession, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
    setHoveredSession(session)
  }

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrap}>
              <Calendar size={16} />
            </div>
            <div>
              <h2 className={styles.title}>Historial de Caja</h2>
              <p className={styles.subtitle}>Sesiones registradas por fecha</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {/* Calendar navigation */}
        <div className={styles.calendarNav}>
          <button className={styles.navBtn} onClick={prevMonth} aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <span className={styles.monthLabel}>
            {MONTHS_ES[currentMonth]} {currentYear}
          </span>
          <button
            className={styles.navBtn}
            onClick={nextMonth}
            disabled={isNextDisabled}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Calendar body */}
        <div className={styles.calendarBody}>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 size={24} className={styles.spinnerIcon} />
              <span>Cargando historial…</span>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className={styles.calendarGrid}>
                {DAYS_ES.map((d) => (
                  <div key={d} className={styles.dayHeader}>
                    {d}
                  </div>
                ))}

                {/* Empty cells for offset */}
                {Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`empty-${i}`} className={styles.dayCell} />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const session = sessionsByDay.get(day)
                  const isToday =
                    day === today.getDate() &&
                    currentMonth === today.getMonth() &&
                    currentYear === today.getFullYear()
                  const isFuture =
                    new Date(currentYear, currentMonth, day) > today

                  let cellClass = styles.dayCell
                  if (isToday) cellClass += ` ${styles.today}`
                  if (isFuture) cellClass += ` ${styles.future}`
                  if (session) {
                    cellClass += ` ${styles.hasSession}`
                    if (session.status === 'OPEN') cellClass += ` ${styles.sessionOpen}`
                    if (session.forcedClose) cellClass += ` ${styles.sessionForced}`
                    if (session.status === 'CLOSED' && !session.forcedClose)
                      cellClass += ` ${styles.sessionClosed}`
                  }

                  return (
                    <div
                      key={day}
                      className={cellClass}
                      onMouseEnter={(e) => session && handleCellHover(session, e)}
                      onMouseLeave={() => setHoveredSession(null)}
                    >
                      <span className={styles.dayNumber}>{day}</span>
                      {session && (
                        <div className={styles.sessionDot}>
                          {session.status === 'OPEN' ? (
                            <Unlock size={8} />
                          ) : session.forcedClose ? (
                            <AlertTriangle size={8} />
                          ) : (
                            <Lock size={8} />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className={styles.legend}>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendClosed}`} />
                  <span>Cerrada</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendOpen}`} />
                  <span>Abierta</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendForced}`} />
                  <span>Cierre forzado</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Floating tooltip */}
        {hoveredSession && (
          <div
            className={styles.tooltip}
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y - 8}px`,
            }}
          >
            <div className={styles.tooltipHeader}>
              {hoveredSession.status === 'OPEN' ? (
                <span className={styles.tooltipBadgeOpen}>
                  <Unlock size={10} /> Abierta
                </span>
              ) : hoveredSession.forcedClose ? (
                <span className={styles.tooltipBadgeForced}>
                  <AlertTriangle size={10} /> Cierre forzado
                </span>
              ) : (
                <span className={styles.tooltipBadgeClosed}>
                  <Lock size={10} /> Cerrada
                </span>
              )}
            </div>

            <div className={styles.tooltipGrid}>
              <div className={styles.tooltipRow}>
                <Clock size={12} />
                <span>
                  Apertura: {formatTime(hoveredSession.openedAt)}
                  {hoveredSession.closedAt && ` — Cierre: ${formatTime(hoveredSession.closedAt)}`}
                </span>
              </div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Inicio:</span>
                <span className={styles.tooltipValue}>{formatGs(hoveredSession.openingAmount)}</span>
              </div>
              {hoveredSession.status === 'CLOSED' && hoveredSession.closingAmount != null && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Cierre:</span>
                  <span className={styles.tooltipValue}>{formatGs(hoveredSession.closingAmount)}</span>
                </div>
              )}
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Ventas:</span>
                <span className={`${styles.tooltipValue} ${styles.positive}`}>
                  +{formatGs(hoveredSession.totalSales)}
                </span>
              </div>
              {hoveredSession.difference !== undefined && hoveredSession.difference !== 0 && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Diferencia:</span>
                  <span
                    className={`${styles.tooltipValue} ${
                      hoveredSession.difference > 0 ? styles.positive : styles.negative
                    }`}
                  >
                    {hoveredSession.difference > 0 ? '+' : ''}{formatGs(hoveredSession.difference)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
