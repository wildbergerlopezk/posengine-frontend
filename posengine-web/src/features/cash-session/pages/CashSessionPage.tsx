"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Wallet, Lock, Unlock, History, Info, AlertCircle, ArrowUpRight, ArrowDownLeft, Plus, Printer, Menu, ArrowLeftRight, List } from 'lucide-react'
import { useCashSession } from '../hooks/useCashSession'
import { OpenCashModal } from '../components/OpenCashModal'
import { CloseCashModal } from '../components/CloseCashModal'
import { AddMovementModal } from '../components/AddMovementModal'
import { HistoryModal } from '../components/HistoryModal'
import { MovementsHistoryModal } from '../components/MovementsHistoryModal'
import { Header } from '@/src/shared/components/Header'

import styles from './CashSessionPage.module.css'

export function CashSessionPage() {
  const { session, loading, error, openCash, closeCash, addMovement, getReport } = useCashSession()
  const [isOpening, setIsOpening] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isMovementOpen, setIsMovementOpen] = useState(false)
  const [isMovementsPanelOpen, setIsMovementsPanelOpen] = useState(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isMovementsHistoryOpen, setIsMovementsHistoryOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [printData, setPrintData] = useState<any>(null)

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
      // Obtener reporte para la impresión antes de cerrar
      const report = await getReport(session!.id)
      setPrintData(report)
      
      await closeCash(session!.id, amount, notes)
      setIsClosing(false)
      
      // Lanzar impresión
      setTimeout(() => {
        window.print()
      }, 300)
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

  const handlePrintCurrent = async () => {
    if (!session) return
    try {
      const report = await getReport(session.id)
      setPrintData(report)
      setTimeout(() => {
        window.print()
      }, 300)
    } catch (err: any) {
      alert('Error al generar el reporte de impresión: ' + err.message)
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

  const currentExpected = session
    ? session.openingAmount +
      (session.totalSales || 0) +
      (session.totalManualInflows || 0) -
      (session.totalPurchases || 0) -
      (session.totalManualOutflows || 0)
    : 0

  return (
    <div className={styles.page}>
      <Header title="Control de Caja" />

      <div className={styles.container}>
        <div className={styles.pageActions}>
          <div />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {session && (
              <button className={styles.historyBtn} type="button" onClick={handlePrintCurrent} disabled>
                <Printer size={16} /> Arqueo Parcial
              </button>
            )}
            <button className={styles.historyBtn} type="button" onClick={() => setIsHistoryOpen(true)}>
              <History size={16} /> Historial
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {session ? (
            <div className={styles.mainLayout}>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.2rem' }}>
                        <span className={styles.statLabel}>Ventas registradas</span>
                        <Link href="/dashboard/sales/history" className={styles.viewLink}>
                          Ver ventas
                        </Link>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-end' }}>
                        <span className={`${styles.statValue} ${styles.positive}`} style={{ fontSize: '0.85rem' }}>
                          Al contado: + {formatGs(session.totalCashSales ?? 0)}
                        </span>
                        <span className={`${styles.statValue}`} style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)', fontWeight: 'normal' }}>
                          A crédito: + {formatGs(session.totalCreditSales ?? 0)}
                        </span>
                      </div>
                    </div>
                    <div className={styles.statItem}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.2rem' }}>
                        <span className={styles.statLabel}>Cobros de deudas</span>
                        <Link href="/dashboard/clients/payments" className={styles.viewLink}>
                          Ver cobros
                        </Link>
                      </div>
                      <span className={`${styles.statValue} ${styles.positive}`}>
                        + {formatGs(session.totalDebtPayments ?? 0)}
                      </span>
                    </div>
                    <div className={styles.statItem}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.2rem' }}>
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
                      <span className={styles.statLabel}>Pagos de deudas a proveedores</span>
                      <span className={`${styles.statValue} ${styles.negative}`}>
                        - {formatGs(session.totalPurchaseDebtPayments ?? 0)}
                      </span>
                    </div>
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
                    <div className={`${styles.statItem} ${styles.statTotal}`}>
                      <span className={styles.statLabel}>Efectivo esperado</span>
                      <span className={styles.statValueLarge}>
                        {formatGs(currentExpected)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <div className={styles.infoBox}>
                    <Info size={16} />
                    <span>Al cerrar la caja deberás contar el efectivo físico disponible.</span>
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
      </div>

      {/* Printable Ticket Area */}
      {printData && (
        <div className={styles.printContainer}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <strong style={{ fontSize: '14px' }}>TICKET DE ARQUEO DE CAJA</strong>
            <br />
            <span>PosEngine System</span>
          </div>
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '5px 0' }} />
          <div>
            <span><strong>Cajero:</strong> {printData.session.openedByName}</span>
            <br />
            <span><strong>Apertura:</strong> {new Date(printData.session.openedAt).toLocaleString('es-PY')}</span>
            {printData.session.closedAt && (
              <>
                <br />
                <span><strong>Cierre:</strong> {new Date(printData.session.closedAt).toLocaleString('es-PY')}</span>
              </>
            )}
            <br />
            <span><strong>Estado:</strong> {printData.session.status === 'OPEN' ? 'ACTIVA (PARCIAL)' : 'CERRADA'}</span>
          </div>
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '5px 0' }} />
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td>Monto Inicial:</td>
                <td style={{ textAlign: 'right' }}>{formatGs(printData.session.openingAmount)}</td>
              </tr>
              <tr>
                <td>(+) Ventas Contado:</td>
                <td style={{ textAlign: 'right' }}>{formatGs(printData.totals.totalCashSales)}</td>
              </tr>
              <tr>
                <td>(+) Cobros Clientes:</td>
                <td style={{ textAlign: 'right' }}>{formatGs(printData.totals.totalDebtPayments)}</td>
              </tr>
              <tr>
                <td>(+) Ingresos Manuales:</td>
                <td style={{ textAlign: 'right' }}>{formatGs(printData.totals.totalManualInflows)}</td>
              </tr>
              <tr>
                <td>(-) Compras Contado:</td>
                <td style={{ textAlign: 'right' }}>-{formatGs(printData.totals.totalCashPurchases)}</td>
              </tr>
              <tr>
                <td>(-) Pagos Proveedores:</td>
                <td style={{ textAlign: 'right' }}>-{formatGs(printData.totals.totalPurchaseDebtPayments)}</td>
              </tr>
              <tr>
                <td>(-) Egresos Manuales:</td>
                <td style={{ textAlign: 'right' }}>-{formatGs(printData.totals.totalManualOutflows)}</td>
              </tr>
            </tbody>
          </table>
          
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '5px 0' }} />
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontWeight: 'bold' }}>
            <tbody>
              <tr>
                <td>Efectivo Esperado:</td>
                <td style={{ textAlign: 'right' }}>
                  {formatGs(
                    printData.session.openingAmount +
                    printData.totals.totalCashSales +
                    printData.totals.totalDebtPayments +
                    printData.totals.totalManualInflows -
                    printData.totals.totalCashPurchases -
                    printData.totals.totalPurchaseDebtPayments -
                    printData.totals.totalManualOutflows
                  )}
                </td>
              </tr>
              {printData.session.closingAmount !== null && (
                <>
                  <tr>
                    <td>Efectivo Real (Cierre):</td>
                    <td style={{ textAlign: 'right' }}>{formatGs(printData.session.closingAmount)}</td>
                  </tr>
                  <tr>
                    <td>Diferencia:</td>
                    <td style={{ textAlign: 'right', color: printData.session.difference < 0 ? 'red' : 'black' }}>
                      {printData.session.difference > 0 ? '+' : ''}{formatGs(printData.session.difference)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {printData.totals.movements && printData.totals.movements.length > 0 && (
            <>
              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '5px 0' }} />
              <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '5px' }}>MOVIMIENTOS MANUALES</div>
              {printData.totals.movements.map((m: any) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <span>{m.description.slice(0, 20)} ({m.type})</span>
                  <span>{m.type === 'IN' ? '+' : '-'} {formatGs(m.amount)}</span>
                </div>
              ))}
            </>
          )}
          
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '15px 0 5px 0' }} />
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <span>.......................................</span>
            <br />
            <span>Firma del Cajero</span>
          </div>
        </div>
      )}
    </div>
  )
}

