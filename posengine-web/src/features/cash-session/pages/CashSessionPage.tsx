"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Wallet, Lock, Unlock, History, Info, AlertCircle, ArrowUpRight, ArrowDownLeft, Plus, Menu, ArrowLeftRight, List } from 'lucide-react'
import { useCashSession } from '../hooks/useCashSession'
import { OpenCashModal } from '../components/OpenCashModal'
import { CloseCashModal } from '../components/CloseCashModal'
import { AddMovementModal } from '../components/AddMovementModal'
import { HistoryModal } from '../components/HistoryModal'
import { MovementsHistoryModal } from '../components/MovementsHistoryModal'
import { CashReconciliationModal } from '../components/CashReconciliationModal'
import { Header } from '@/src/shared/components/Header'

import styles from './CashSessionPage.module.css'

export function CashSessionPage() {
  const { session, loading, error, openCash, closeCash, addMovement, getReconciliationItems, classifyPayment } = useCashSession()
  const [isOpening, setIsOpening] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isMovementOpen, setIsMovementOpen] = useState(false)
  const [isMovementsPanelOpen, setIsMovementsPanelOpen] = useState(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isMovementsHistoryOpen, setIsMovementsHistoryOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [isReconciliationTooltipOpen, setIsReconciliationTooltipOpen] = useState(false)
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false)

  const formatGs = (val: number) => `Gs. ${val.toLocaleString('es-PY')}`

  const handleOpen = async (amount: number, notes?: string) => {
    setActionLoading(true)
    try {
      await openCash(amount, notes)
      setIsOpening(false)
    } finally {
      setActionLoading(false)
    }
  }

  const handleClose = async (amount: number, notes?: string) => {
    setActionLoading(true)
    try {
      await closeCash(session!.id, amount, notes)
      setIsClosing(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRegisterMovement = async (amount: number, type: 'IN' | 'OUT', description: string) => {
    setActionLoading(true)
    try {
      await addMovement(amount, type, description)
      setIsMovementOpen(false)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>Cargando estado de caja...</p>
      </div>
    )
  }

  const currentExpected = session?.expectedCashAmount ?? null

  return (
    <div className={styles.page}>
      <Header title="Control de Caja" />

      <div className={styles.container}>
        <div className={styles.pageActions}>
          <div />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={styles.historyBtn} type="button" onClick={() => setIsHistoryOpen(true)}>
              <History size={16} /> Historial
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {session ? (
            <div className={`${styles.mainLayout} ${!isMovementsPanelOpen ? styles.mainLayoutCollapsed : ''}`}>
              <div className={styles.statusCard}>
                <div className={styles.sessionGrid}>
                  <div className={styles.mainInfo}>
                    <div className={styles.iconRow}>
                      <div className={styles.iconCircle}>
                        <Wallet size={32} className={styles.primaryIcon} />
                      </div>
                      <div className={`${styles.statusBadge} ${styles.statusOpen}`}>
                        <Unlock size={14} /> Caja Abierta
                      </div>
                    </div>
                    <div className={styles.mainDetails}>
                      <h3>Sesión activa</h3>
                      <p>Iniciada el {new Date(session.openedAt).toLocaleString('es-PY')}</p>
                      <div className={styles.openingAmountCard}>
                        <span className={styles.statLabel}>Monto inicial</span>
                        <span className={styles.openingAmountValue}>{formatGs(session.openingAmount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                      <div className={styles.statHeading}>
                        <span className={styles.statLabel}>Ventas registradas</span>
                        <Link href="/dashboard/sales/history" className={styles.viewLink}>
                          Ver ventas
                        </Link>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-end' }}>
                        <span className={`${styles.statValue} ${styles.positive}`} style={{ fontSize: '0.85rem' }}>
                          Efectivo: + {formatGs(session.totalPhysicalCashSales ?? 0)}
                        </span>
                        <span className={`${styles.statValue}`} style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)', fontWeight: 'normal' }}>
                          Electrónico: + {formatGs(session.totalElectronicSales ?? 0)}
                        </span>
                        <span className={`${styles.statValue}`} style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)', fontWeight: 'normal' }}>
                          A crédito: + {formatGs(session.totalCreditSales ?? 0)}
                        </span>
                      </div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statHeading}>
                        <span className={styles.statLabel}>Cobros de deudas</span>
                        <Link href="/dashboard/clients/payments" className={styles.viewLink}>
                          Ver cobros
                        </Link>
                      </div>
                      <span className={`${styles.statValue} ${styles.positive}`}>
                        Efectivo: + {formatGs(session.totalCashDebtPayments ?? 0)}
                      </span>
                      <span className={`${styles.statValue}`} style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)', fontWeight: 'normal' }}>
                        Electrónico: + {formatGs(session.totalElectronicDebtPayments ?? 0)}
                      </span>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statHeading}>
                        <span className={styles.statLabel}>Compras registradas</span>
                        <Link href="/dashboard/purchases/history" className={styles.viewLink}>
                          Ver compras
                        </Link>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        <span className={`${styles.statValue} ${styles.negative}`} style={{ fontSize: '0.85rem' }}>
                          Al contado: - {formatGs(session.totalCashPurchases ?? 0)}
                        </span>
                        <span className={`${styles.statValue}`} style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)', fontWeight: 'normal' }}>
                          A crédito: - {formatGs(session.totalCreditPurchases ?? 0)}
                        </span>
                      </div>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Pagos de deudas a proveedores en efectivo</span>
                      <span className={`${styles.statValue} ${styles.negative}`}>
                        - {formatGs(session.totalCashPurchaseDebtPayments ?? 0)}
                      </span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Transferencias a proveedores (no afectan efectivo)</span>
                      <span className={styles.statValue}>
                        {formatGs(session.totalElectronicPurchaseDebtPayments ?? 0)}
                      </span>
                    </div>
                    {(session.unclassifiedSupplierPayments ?? 0) > 0 && (
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>Pagos de proveedores sin clasificar</span>
                        <span className={styles.statValue}>
                          {formatGs(session.unclassifiedSupplierPayments ?? 0)}
                        </span>
                      </div>
                    )}
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Ingresos manuales</span>
                      <span className={`${styles.statValue} ${styles.positive}`}>
                        + {formatGs(session.totalManualInflows ?? 0)}
                      </span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Egresos manuales</span>
                      <span className={`${styles.statValue} ${styles.negative}`}>
                        - {formatGs(session.totalManualOutflows ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <div className={styles.expectedSummary}>
                    <div className={styles.statTotal}>
                      <span className={styles.statLabel}>Efectivo esperado</span>
                      <div className={styles.expectedValueRow}>
                        <span className={currentExpected === null ? styles.pendingExpected : styles.statValueLarge}>
                          {currentExpected === null ? (
                            <button
                              type="button"
                              className={`${styles.pendingExpected} ${styles.pendingExpectedButton}`}
                              onClick={() => setIsReconciliationOpen(true)}
                              aria-label="Abrir conciliación de caja"
                            >
                              Pendiente de conciliación
                            </button>
                          ) : formatGs(currentExpected)}
                        </span>
                        {session.cashReconciliationRequired && (
                          <span className={styles.reconciliationTooltipWrap}>
                            <button
                              type="button"
                              className={styles.reconciliationInfoButton}
                              aria-label="Información sobre la conciliación pendiente"
                              aria-describedby="cash-reconciliation-tooltip"
                              aria-controls="cash-reconciliation-tooltip"
                              aria-expanded={isReconciliationTooltipOpen}
                              onClick={() => setIsReconciliationOpen(true)}
                              onPointerEnter={(event) => {
                                if (event.pointerType !== 'touch') setIsReconciliationTooltipOpen(true)
                              }}
                              onPointerLeave={(event) => {
                                if (event.pointerType !== 'touch') setIsReconciliationTooltipOpen(false)
                              }}
                              onPointerDown={(event) => {
                                if (event.pointerType === 'touch') {
                                  setIsReconciliationTooltipOpen((isOpen) => !isOpen)
                                }
                              }}
                              onFocus={() => setIsReconciliationTooltipOpen(true)}
                              onBlur={() => setIsReconciliationTooltipOpen(false)}
                            >
                              <AlertCircle size={16} aria-hidden="true" />
                            </button>
                            <span
                              id="cash-reconciliation-tooltip"
                              className={styles.reconciliationTooltip}
                              role="tooltip"
                              hidden={!isReconciliationTooltipOpen}
                            >
                              Existen pagos sin un medio de pago clasificado. El efectivo esperado no puede determinarse correctamente hasta completar la conciliación. El cierre de caja permanece bloqueado.
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.infoBox}>
                      <Info size={14} aria-hidden="true" />
                      <span>Contá el efectivo físico antes del cierre.</span>
                    </div>
                  </div>
                  <button className={styles.closeBtn} onClick={() => setIsClosing(true)}>
                    <Lock size={16} /> Cerrar Caja
                  </button>
                </div>
              </div>

              <aside
                className={`${styles.movementsPanel} ${isMovementsPanelOpen ? styles.movementsPanelOpen : ''}`}
              >
                <div className={styles.movementsPanelHeader}>
                  <button
                    className={styles.menuButton}
                    type="button"
                    onClick={() => setIsMovementsPanelOpen((prev) => !prev)}
                    aria-label="Toggle movimientos manuales"
                  >
                    <Menu size={24} />
                  </button>
                  {isMovementsPanelOpen && (
                    <span className={styles.movementsPanelTitle}>Movimientos manuales</span>
                  )}
                </div>

                <div className={styles.movementsPanelBody}>
                  {isMovementsPanelOpen && (
                    <>
                      <div className={styles.movementsList}>
                        {session.movements && session.movements.length > 0 ? (
                          session.movements.map((m: any) => (
                            <div key={m.id} className={styles.movementRow}>
                              <div className={styles.movementLeft}>
                                <div className={`${styles.movementIconWrap} ${m.type === 'IN' ? styles.movementIconIn : styles.movementIconOut}`}>
                                  {m.type === 'IN' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                                </div>
                                <div className={styles.movementDetails}>
                                  <span className={styles.movementDesc}>{m.description}</span>
                                  <span className={styles.movementTime}>
                                    {new Date(m.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                              <span className={`${styles.movementAmount} ${m.type === 'IN' ? styles.positive : styles.negative}`}>
                                {m.type === 'IN' ? '+' : '-'} {formatGs(m.amount)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className={styles.emptyMovements}>No hay movimientos manuales registrados en esta sesión.</p>
                        )}
                      </div>
                      {session.movements && session.movements.length > 0 && (
                        <button
                          className={styles.viewAllBtn}
                          type="button"
                          onClick={() => setIsMovementsHistoryOpen(true)}
                        >
                          <List size={14} />
                          Ver todos
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className={styles.movementsPanelFooter}>
                  {isMovementsPanelOpen ? (
                    <button
                      className={styles.registerMovementBtnExpanded}
                      type="button"
                      onClick={() => setIsMovementOpen(true)}
                    >
                      <Plus size={18} />
                      <span>Registrar movimiento</span>
                    </button>
                  ) : (
                    <button
                      className={styles.registerMovementBtnCollapsed}
                      type="button"
                      title="Registrar movimiento"
                      onClick={() => {
                        setIsMovementsPanelOpen(true)
                        setIsMovementOpen(true)
                      }}
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </div>
              </aside>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrap}>
                <Wallet size={48} className={styles.mutedIcon} />
              </div>
              <h2>Caja cerrada</h2>
              <p>Debes abrir la caja para comenzar a registrar movimientos y ventas.</p>
              <button className={styles.openBtn} onClick={() => setIsOpening(true)}>
                <Unlock size={16} /> Abrir Caja
              </button>
            </div>
          )}

          {error && (
            <div className={styles.errorAlert}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <OpenCashModal
          open={isOpening}
          loading={actionLoading}
          onConfirm={handleOpen}
          onClose={() => setIsOpening(false)}
        />

        <CloseCashModal
          open={isClosing}
          session={session}
          loading={actionLoading}
          onConfirm={handleClose}
          onClose={() => setIsClosing(false)}
        />

        <AddMovementModal
          open={isMovementOpen}
          loading={actionLoading}
          onConfirm={handleRegisterMovement}
          onClose={() => setIsMovementOpen(false)}
        />

        <HistoryModal open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />

        <MovementsHistoryModal
          open={isMovementsHistoryOpen}
          session={session}
          onClose={() => setIsMovementsHistoryOpen(false)}
        />

        <CashReconciliationModal
          open={isReconciliationOpen}
          onClose={() => setIsReconciliationOpen(false)}
          loadItems={getReconciliationItems}
          onClassify={classifyPayment}
        />
      </div>

    </div>
  )
}

