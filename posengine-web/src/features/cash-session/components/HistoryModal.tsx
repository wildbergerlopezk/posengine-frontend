import { useState, useEffect, useRef, useMemo, type MouseEvent } from 'react'
import { X, ChevronLeft, ChevronRight, Loader2, Calendar, Unlock, Lock, AlertTriangle, Clock } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
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
  const [hoveredSessions, setHoveredSessions] = useState<CashSession[] | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const tooltipCloseTimeout = useRef<number | null>(null)
  const { sessions, loading, error, fetchHistory } = useCashHistory()

  useEffect(() => {
    if (open) {
      fetchHistory(currentYear, currentMonth + 1)
    }
  }, [open, currentYear, currentMonth, fetchHistory])

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

  const sessionsByDay = useMemo(() => {
    const map = new Map<number, CashSession[]>()
    sessions.forEach((s) => {
      const d = new Date(s.openedAt).getDate()
      const existing = map.get(d) ?? []
      existing.push(s)
      map.set(d, existing)
    })

    for (const sessionsForDay of map.values()) {
      sessionsForDay.sort(
        (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
      )
    }

    return map
  }, [sessions])

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
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
    if (isCurrentMonth) return
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const isNextDisabled =
    currentYear === today.getFullYear() && currentMonth === today.getMonth()

  const clearTooltipTimeout = () => {
    if (tooltipCloseTimeout.current) {
      window.clearTimeout(tooltipCloseTimeout.current)
      tooltipCloseTimeout.current = null
    }
  }

  const handleCellHover = (sessions: CashSession[], e: MouseEvent) => {
    clearTooltipTimeout()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
    setHoveredSessions(sessions)
  }

  const handleTooltipEnter = () => {
    clearTooltipTimeout()
  }

  const handleTooltipLeave = () => {
    clearTooltipTimeout()
    tooltipCloseTimeout.current = window.setTimeout(() => {
      setHoveredSessions(null)
      tooltipCloseTimeout.current = null
    }, 100)
  }

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className={styles.modal}>
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

        <div className={styles.calendarNav}>
          <button className={styles.navBtn} onClick={prevMonth} aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <span className={styles.monthLabel}>
            {MONTHS_ES[currentMonth]} {currentYear}
          </span>
          <button className={styles.navBtn} onClick={nextMonth} disabled={isNextDisabled} aria-label="Mes siguiente">
            <ChevronRight size={18} />
          </button>
        </div>

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
              <div className={styles.calendarGrid}>
                {DAYS_ES.map((d) => (
                  <div key={d} className={styles.dayHeader}>
                    {d}
                  </div>
                ))}

                {Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`empty-${i}`} className={styles.dayCell} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const daySessions = sessionsByDay.get(day) ?? []
                  const isToday =
                    day === today.getDate() &&
                    currentMonth === today.getMonth() &&
                    currentYear === today.getFullYear()
                  const isFuture =
                    new Date(currentYear, currentMonth, day) > today

                  const hasOpenSession = daySessions.some((s) => s.status === 'OPEN')
                  const sessionState = hasOpenSession
                    ? 'OPEN'
                    : daySessions[0]?.status

                  let cellClass = styles.dayCell
                  if (isToday) cellClass += ` ${styles.today}`
                  if (isFuture) cellClass += ` ${styles.future}`
                  if (daySessions.length > 0) {
                    cellClass += ` ${styles.hasSession}`
                    if (sessionState === 'OPEN') cellClass += ` ${styles.sessionOpen}`
                    if (sessionState === 'CLOSED') cellClass += ` ${styles.sessionClosed}`
                  }

                  return (
                    <div
                      key={day}
                      className={cellClass}
                      onMouseEnter={(e) => daySessions.length > 0 && handleCellHover(daySessions, e)}
                      onMouseLeave={handleTooltipLeave}
                    >
                      <span className={styles.dayNumber}>{day}</span>
                      {daySessions.length > 0 && (
                        <div className={styles.sessionDot}>
                          {daySessions.length > 1 ? (
                            <span className={styles.sessionCount}>{daySessions.length}</span>
                          ) : sessionState === 'OPEN' ? (
                            <Unlock size={8} />
                          ) : (
                            <Lock size={8} />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className={styles.legend}>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendClosed}`} />
                  <span>Cerrada</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendOpen}`} />
                  <span>Abierta</span>
                </div>
              </div>
            </>
          )}
        </div>

        {hoveredSessions && (
          <div
            className={styles.tooltip}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleTooltipLeave}
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y - 8}px`,
            }}
          >
            <div className={styles.tooltipHeader}>
              {hoveredSessions.length > 1 ? (
                <span className={styles.tooltipBadgeMultiple}>
                  {hoveredSessions.length} sesiones
                </span>
              ) : hoveredSessions[0].status === 'OPEN' ? (
                <span className={styles.tooltipBadgeOpen}>
                  <Unlock size={10} /> Abierta
                </span>
              ) : (
                <span className={styles.tooltipBadgeClosed}>
                  <Lock size={10} /> Cerrada
                </span>
              )}
            </div>

            {hoveredSessions.length === 1 ? (
              <div className={styles.tooltipContentSingle}>
                {hoveredSessions.map((session) => (
                  <div key={session.id} className={styles.tooltipSessionSingle}>
                    <div className={styles.tooltipRow}>
                      <Clock size={12} />
                      <span>
                        Apertura: {formatTime(session.openedAt)}
                        {session.closedAt && ` — Cierre: ${formatTime(session.closedAt)}`}
                      </span>
                    </div>
                    <div className={styles.tooltipRow}>
                      <span className={styles.tooltipLabel}>Inicio:</span>
                      <span className={styles.tooltipValue}>{formatGs(session.openingAmount)}</span>
                    </div>
                    {session.status === 'CLOSED' && session.closingAmount != null && (
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipLabel}>Cierre:</span>
                        <span className={styles.tooltipValue}>{formatGs(session.closingAmount)}</span>
                      </div>
                    )}
                    <div className={styles.tooltipRow}>
                      <span className={styles.tooltipLabel}>Ventas:</span>
                      <span className={`${styles.tooltipValue} ${styles.positive}`}>
                        +{formatGs(session.totalSales)}
                      </span>
                    </div>
                    {session.difference !== undefined && session.difference !== 0 && (
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipLabel}>Diferencia:</span>
                        <span
                          className={`${styles.tooltipValue} ${
                            session.difference > 0 ? styles.positive : styles.negative
                          }`}
                        >
                          {session.difference > 0 ? '+' : ''}{formatGs(session.difference)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Accordion type="single" defaultValue="" collapsible className={styles.tooltipAccordion}>
                {hoveredSessions.map((session, index) => (
                  <AccordionItem key={session.id} value={session.id} className={styles.accordionItem}>
                    <AccordionTrigger className={styles.accordionTrigger}>
                      <div className={styles.accordionTriggerContent}>
                        <span>Sesión {index + 1}</span>
                        <span className={styles.accordionStatus}>
                          {session.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className={styles.accordionContent}>
                      <div className={styles.tooltipRow}>
                        <Clock size={12} />
                        <span>
                          Apertura: {formatTime(session.openedAt)}
                          {session.closedAt && ` — Cierre: ${formatTime(session.closedAt)}`}
                        </span>
                      </div>
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipLabel}>Inicio:</span>
                        <span className={styles.tooltipValue}>{formatGs(session.openingAmount)}</span>
                      </div>
                      {session.status === 'CLOSED' && session.closingAmount != null && (
                        <div className={styles.tooltipRow}>
                          <span className={styles.tooltipLabel}>Cierre:</span>
                          <span className={styles.tooltipValue}>{formatGs(session.closingAmount)}</span>
                        </div>
                      )}
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipLabel}>Ventas:</span>
                        <span className={`${styles.tooltipValue} ${styles.positive}`}>
                          +{formatGs(session.totalSales)}
                        </span>
                      </div>
                      {session.difference !== undefined && session.difference !== 0 && (
                        <div className={styles.tooltipRow}>
                          <span className={styles.tooltipLabel}>Diferencia:</span>
                          <span
                            className={`${styles.tooltipValue} ${
                              session.difference > 0 ? styles.positive : styles.negative
                            }`}
                          >
                            {session.difference > 0 ? '+' : ''}{formatGs(session.difference)}
                          </span>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
