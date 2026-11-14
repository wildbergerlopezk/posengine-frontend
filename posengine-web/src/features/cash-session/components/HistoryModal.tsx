import { useState, useEffect, useLayoutEffect, useRef, useMemo, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { X, ChevronLeft, ChevronRight, Loader2, Calendar, Unlock, Lock, AlertTriangle, Clock, ArrowLeft } from 'lucide-react'
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
  if (val == null) return 'Gs. 0'
  return `Gs. ${Number(val).toLocaleString('es-PY')}`
}

function formatTime(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(year: number, month: number, day: number) {
  return new Date(year, month, day).toLocaleDateString('es-PY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function SessionDetail({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={`${styles.detailValue} ${tone ? styles[tone] : ''}`}>{value}</span>
    </div>
  )
}

export function HistoryModal({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const detailHeadingRef = useRef<HTMLHeadingElement>(null)
  const dayCellRefs = useRef(new Map<number, HTMLButtonElement>())
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [view, setView] = useState<'calendar' | 'sessions'>('calendar')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [expandedSessionId, setExpandedSessionId] = useState('')
  const { sessions, loading, error, fetchHistory } = useCashHistory()

  useEffect(() => {
    if (open) fetchHistory(currentYear, currentMonth + 1)
  }, [open, currentYear, currentMonth, fetchHistory])

  useEffect(() => {
    if (!open) {
      setView('calendar')
      setSelectedDay(null)
      setExpandedSessionId('')
      return
    }

    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setView('calendar')
        setSelectedDay(null)
        setExpandedSessionId('')
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, onClose])

  useLayoutEffect(() => {
    if (view === 'sessions') detailHeadingRef.current?.focus()
    else if (selectedDay !== null) dayCellRefs.current.get(selectedDay)?.focus()
  }, [view, selectedDay])

  const sessionsByDay = useMemo(() => {
    const map = new Map<number, CashSession[]>()
    sessions.forEach((session) => {
      const day = new Date(session.openedAt).getDate()
      const existing = map.get(day) ?? []
      existing.push(session)
      map.set(day, existing)
    })

    for (const daySessions of map.values()) {
      daySessions.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime())
    }
    return map
  }, [sessions])

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const selectedSessions = selectedDay === null ? [] : sessionsByDay.get(selectedDay) ?? []
  const selectedDateLabel = selectedDay === null ? '' : formatDate(currentYear, currentMonth, selectedDay)

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((year) => year - 1)
    } else {
      setCurrentMonth((month) => month - 1)
    }
  }

  const nextMonth = () => {
    const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth()
    if (isCurrentMonth) return
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((year) => year + 1)
    } else {
      setCurrentMonth((month) => month + 1)
    }
  }

  const isNextDisabled = currentYear === today.getFullYear() && currentMonth === today.getMonth()

  const closeModal = () => {
    setView('calendar')
    setSelectedDay(null)
    setExpandedSessionId('')
    onClose()
  }

  const selectDay = (day: number) => {
    setSelectedDay(day)
    setExpandedSessionId('')
    setView('sessions')
  }

  const returnToCalendar = () => {
    setExpandedSessionId('')
    setView('calendar')
  }

  const handleDayKeyDown = (day: number, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectDay(day)
    }
  }

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(event) => event.target === overlayRef.current && closeModal()}
    >
      <div
        data-pos-modal
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-history-title"
        className={`${styles.modal} ${view === 'sessions' ? styles.modalDetail : ''}`}
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {view === 'sessions' ? (
              <button
                type="button"
                className={styles.backBtn}
                onClick={returnToCalendar}
                aria-label="Volver al calendario"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div className={styles.iconWrap} aria-hidden="true">
                <Calendar size={16} />
              </div>
            )}
            <div>
              <h2 id="cash-history-title" ref={detailHeadingRef} tabIndex={-1} className={styles.title}>
                {view === 'sessions' ? 'Sesiones del día' : 'Historial de Caja'}
              </h2>
              <p className={styles.subtitle}>
                {view === 'sessions'
                  ? `${selectedDateLabel} · ${selectedSessions.length} ${selectedSessions.length === 1 ? 'sesión registrada' : 'sesiones registradas'}`
                  : 'Sesiones registradas por fecha'}
              </p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {view === 'calendar' ? (
          <>
            <div className={styles.calendarNav}>
              <button type="button" className={styles.navBtn} onClick={prevMonth} aria-label="Mes anterior">
                <ChevronLeft size={18} />
              </button>
              <span className={styles.monthLabel}>
                {MONTHS_ES[currentMonth]} {currentYear}
              </span>
              <button type="button" className={styles.navBtn} onClick={nextMonth} disabled={isNextDisabled} aria-label="Mes siguiente">
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
                    {DAYS_ES.map((dayName) => (
                      <div key={dayName} className={styles.dayHeader}>{dayName}</div>
                    ))}

                    {Array.from({ length: startOffset }).map((_, index) => (
                      <div key={`empty-${index}`} className={styles.dayCell} />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, index) => {
                      const day = index + 1
                      const daySessions = sessionsByDay.get(day) ?? []
                      const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
                      const isFuture = new Date(currentYear, currentMonth, day) > today
                      const hasOpenSession = daySessions.some((session) => session.status === 'OPEN')
                      const sessionState = hasOpenSession ? 'OPEN' : daySessions[0]?.status

                      let cellClass = styles.dayCell
                      if (isToday) cellClass += ` ${styles.today}`
                      if (isFuture) cellClass += ` ${styles.future}`
                      if (selectedDay === day) cellClass += ` ${styles.selectedDay}`
                      if (daySessions.length > 0) {
                        cellClass += ` ${styles.hasSession}`
                        if (sessionState === 'OPEN') cellClass += ` ${styles.sessionOpen}`
                        if (sessionState === 'CLOSED') cellClass += ` ${styles.sessionClosed}`
                      }

                      return (
                        <button
                          type="button"
                          key={day}
                          ref={(element) => {
                            if (element) dayCellRefs.current.set(day, element)
                            else dayCellRefs.current.delete(day)
                          }}
                          className={cellClass}
                          disabled={daySessions.length === 0}
                          aria-label={daySessions.length > 0 ? `${day} de ${MONTHS_ES[currentMonth]}, ${daySessions.length} ${daySessions.length === 1 ? 'sesión' : 'sesiones'}` : undefined}
                          aria-pressed={daySessions.length > 0 ? selectedDay === day : undefined}
                          onClick={() => daySessions.length > 0 && selectDay(day)}
                          onKeyDown={(event) => daySessions.length > 0 && handleDayKeyDown(day, event)}
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
                        </button>
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
                  <p className={styles.calendarHint}>Seleccioná un día para consultar sus sesiones.</p>
                </>
              )}
            </div>
          </>
        ) : (
          <div className={styles.sessionsView}>
            <Accordion
              type="single"
              collapsible
              value={expandedSessionId}
              onValueChange={setExpandedSessionId}
              className={styles.sessionAccordion}
            >
              {selectedSessions.map((session, index) => (
                <AccordionItem key={session.id} value={session.id} className={styles.sessionCard}>
                  <AccordionTrigger className={styles.sessionTrigger}>
                    <span className={styles.sessionTriggerContent}>
                      <span className={styles.sessionSummaryLine}>
                        <span className={styles.sessionNumber}>Sesión {index + 1}</span>
                        <span className={`${styles.sessionStatus} ${session.status === 'OPEN' ? styles.statusOpen : styles.statusClosed}`}>
                          {session.status === 'OPEN' ? <Unlock size={12} /> : <Lock size={12} />}
                          {session.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                        </span>
                      </span>
                      <span className={styles.sessionTime}>
                        <Clock size={13} aria-hidden="true" />
                        Apertura: {formatTime(session.openedAt)}
                        {session.closedAt && ` · Cierre: ${formatTime(session.closedAt)}`}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className={styles.sessionDetailsContent}>
                    <div className={styles.sessionDetailsGrid}>
                      <SessionDetail label="Monto inicial" value={formatGs(session.openingAmount)} />
                      {(session.expectedAmount != null || session.expectedCashAmount != null) && (
                        <SessionDetail label="Efectivo esperado" value={formatGs(session.expectedAmount ?? session.expectedCashAmount)} />
                      )}
                      {session.closingAmount != null && (
                        <SessionDetail label="Efectivo contado" value={formatGs(session.closingAmount)} />
                      )}
                      <SessionDetail label="Ventas" value={formatGs(session.totalSales)} tone="positive" />
                      {session.totalPurchases !== undefined && (
                        <SessionDetail label="Compras" value={formatGs(session.totalPurchases)} />
                      )}
                      {session.totalManualInflows != null && (
                        <SessionDetail label="Ingresos manuales" value={formatGs(session.totalManualInflows)} tone="positive" />
                      )}
                      {session.totalManualOutflows != null && (
                        <SessionDetail label="Egresos manuales" value={formatGs(session.totalManualOutflows)} tone="negative" />
                      )}
                      {session.difference != null && (
                        <SessionDetail
                          label="Diferencia"
                          value={`${session.difference > 0 ? '+' : ''}${formatGs(session.difference)}`}
                          tone={session.difference > 0 ? 'positive' : session.difference < 0 ? 'negative' : undefined}
                        />
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </div>
    </div>
  )
}
