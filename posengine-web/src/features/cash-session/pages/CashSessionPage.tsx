"use client"

import { useState } from 'react'
import { Wallet, Lock, Unlock, History, Info, AlertCircle } from 'lucide-react'
import { useCashSession } from '../hooks/useCashSession'
import { OpenCashModal } from '../components/OpenCashModal'
import { CloseCashModal } from '../components/CloseCashModal'
import { HistoryModal } from '../components/HistoryModal'
import { Header } from '@/src/shared/components/Header'

import styles from './CashSessionPage.module.css'

export function CashSessionPage() {
  const { session, loading, error, openCash, closeCash } = useCashSession()
  const [isOpening, setIsOpening] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

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

  return (
    <div className={styles.page}>
      <Header title="Control de Caja" />

      <div className={styles.container}>
        <div className={styles.pageActions}>
          <div />
          <button className={styles.historyBtn} type="button" onClick={() => setIsHistoryOpen(true)}>
            <History size={16} /> Historial
          </button>
        </div>

        <div className={styles.content}>
          {session ? (
            <div className={styles.statusCard}>
              <div className={`${styles.statusBadge} ${styles.statusOpen}`}>
                <Unlock size={14} /> Caja Abierta
              </div>

              <div className={styles.sessionGrid}>
                <div className={styles.mainInfo}>
                  <div className={styles.iconCircle}>
                    <Wallet size={32} className={styles.primaryIcon} />
                  </div>
                  <div className={styles.mainDetails}>
                    <h3>Sesión activa</h3>
                    <p>Iniciada el {new Date(session.openedAt).toLocaleString('es-PY')}</p>
                  </div>
                </div>

                <div className={styles.statsGrid}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Monto inicial</span>
                    <span className={styles.statValue}>{formatGs(session.openingAmount)}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Ventas registradas</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-end' }}>
                      <span className={`${styles.statValue} ${styles.positive}`} style={{ fontSize: '0.85rem' }}>
                        Al contado: + {formatGs(session.totalCashSales ?? session.totalSales)}
                      </span>
                      <span className={`${styles.statValue}`} style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)', fontWeight: 'normal' }}>
                        Crédito pendiente: + {formatGs(session.totalCreditSales ?? 0)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Cobros de deudas</span>
                    <span className={`${styles.statValue} ${styles.positive}`}>
                      + {formatGs(session.totalDebtPayments ?? 0)}
                    </span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Compras registradas</span>
                    <span className={`${styles.statValue} ${styles.negative}`}>- {formatGs(session.totalPurchases)}</span>
                  </div>
                  <div className={`${styles.statItem} ${styles.statTotal}`}>
                    <span className={styles.statLabel}>Efectivo esperado</span>
                    <span className={styles.statValueLarge}>
                      {formatGs(session.openingAmount + session.totalSales - session.totalPurchases)}
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

        <HistoryModal open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      </div>
    </div>
  )
}
