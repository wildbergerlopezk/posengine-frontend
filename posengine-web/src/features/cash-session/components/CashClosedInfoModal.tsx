// src/cash-session/components/CashClosedInfoModal.tsx
import { useEffect } from 'react'
import { X, ShieldCheck, Clock, BarChart2, History, Info } from 'lucide-react'
import styles from './CashClosedInfoModal.module.css'

interface Props {
  open: boolean
  onClose: () => void
  onOpenHistory?: () => void
}

const REASONS = [
  {
    icon: <ShieldCheck size={16} />,
    title: 'Integridad del cierre',
    desc: 'El resumen del día ya fue calculado y guardado. Reabrir alteraría los totales y dejaría el historial inconsistente.',
  },
  {
    icon: <BarChart2 size={16} />,
    title: 'Un ciclo por día',
    desc: 'Cada sesión corresponde a un día laboral completo. Esto garantiza que los reportes reflejen exactamente lo que ocurrió.',
  },
  {
    icon: <Clock size={16} />,
    title: 'Control de auditoría',
    desc: 'Una vez cerrada, la sesión queda registrada como definitiva. Cualquier cambio posterior requeriría ajustes manuales con trazabilidad.',
  },
]

export function CashClosedInfoModal({ open, onClose, onOpenHistory }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrap}>
              <Info size={16} />
            </div>
            <div>
              <h2 className={styles.title}>¿Por qué no se puede reabrir?</h2>
              <p className={styles.subtitle}>La caja ya fue cerrada hoy</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.intro}>
            Una vez realizado el cierre de caja, la sesión del día queda <strong>bloqueada intencionalmente</strong>. Estas son las razones:
          </p>

          <div className={styles.reasonsList}>
            {REASONS.map((r, i) => (
              <div key={i} className={styles.reasonItem}>
                <div className={styles.reasonIcon}>{r.icon}</div>
                <div>
                  <p className={styles.reasonTitle}>{r.title}</p>
                  <p className={styles.reasonDesc}>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.tip}>
            <span className={styles.tipLabel}>¿Cometiste un error en el cierre?</span>
            <span className={styles.tipText}>
              Podés revisar el resumen en el historial. Si hay una diferencia importante,
              registrala como observación en la próxima apertura para mantener el control.
            </span>
          </div>
        </div>

        <div className={styles.footer}>
          {onOpenHistory && (
            <button className={styles.historyBtn} type="button" onClick={() => { onClose(); onOpenHistory() }}>
              <History size={14} /> Ver historial de hoy
            </button>
          )}
          <button className={styles.okBtn} type="button" onClick={onClose}>
            Entendido
          </button>
        </div>

      </div>
    </div>
  )
}
