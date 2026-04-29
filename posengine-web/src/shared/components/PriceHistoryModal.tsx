import { X, TrendingDown, TrendingUp, Minus, Loader2, Receipt } from "lucide-react" 
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency" 
import type { PriceHistoryEntry } from "@/src/shared/hooks/usePriceHistory" 
import styles from "./PriceHistoryModal.module.css" 
import { useEffect } from "react"
 
interface Props { 
  open: boolean 
  loading: boolean 
  productName: string 
  history: PriceHistoryEntry[] 
  onClose: () => void 
} 
 
function formatDate(iso: string) { 
  return new Date(iso).toLocaleDateString("es-PY", { 
    day: "2-digit", month: "2-digit", year: "numeric", 
  }) 
} 
 
export function PriceHistoryModal({ open, loading, productName, history, onClose }: Props) { 
  // ── Manejo de Escape propio, sin propagarse al modal padre ──────────────── 
  useEffect(() => { 
    if (!open) return 
    const handler = (e: KeyboardEvent) => { 
      if (e.key === "Escape") { 
        e.stopPropagation()  // evita que llegue al listener del modal de productos 
        onClose() 
      } 
    } 
    // useCapture: true — se ejecuta en la fase de captura, antes que los listeners del modal padre 
    window.addEventListener("keydown", handler, true) 
    return () => window.removeEventListener("keydown", handler, true) 
  }, [open, onClose]) 

  if (!open) return null 
 
  return ( 
    <div 
      className={styles.overlay} 
      onClick={onClose}
      onKeyDown={(e) => e.stopPropagation()} // bloquea bubbling desde el DOM también
    > 
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}> 
 
        <div className={styles.header}> 
          <div className={styles.headerLeft}> 
            <Receipt size={16} className={styles.headerIcon} /> 
            <div> 
              <h2 className={styles.title}>Último precio</h2> 
              <p className={styles.subtitle}>{productName}</p> 
            </div> 
          </div> 
          <button type="button" className={styles.closeBtn} onClick={onClose}> 
            <X size={16} /> 
          </button> 
        </div> 
 
        <div className={styles.body}> 
          {loading ? ( 
            <div className={styles.empty}> 
              <Loader2 size={22} className={styles.spinner} /> 
            </div> 
          ) : history.length === 0 ? ( 
            <div className={styles.empty}> 
              <p>Sin historial de compras para este producto</p> 
            </div> 
          ) : ( 
            <table className={styles.table}> 
              <thead> 
                <tr> 
                  <th>Fecha</th> 
                  <th>Factura</th> 
                  <th>Proveedor</th> 
                  <th style={{ textAlign: "right" }}>Cant.</th> 
                  <th style={{ textAlign: "right" }}>Precio unit.</th> 
                  <th style={{ textAlign: "right" }}>Var.</th> 
                </tr> 
              </thead> 
              <tbody> 
                {history.map((entry, idx) => { 
                  const prev = history[idx + 1] 
                  const diff = prev ? entry.unitCost - prev.unitCost : null 
                  return ( 
                    <tr key={`${entry.invoiceNumber}-${idx}`} className={idx === 0 ? styles.rowLatest : ""}> 
                      <td>{formatDate(entry.date)}</td> 
                      <td><span className={styles.invoice}>{entry.invoiceNumber}</span></td> 
                      <td>{entry.supplier.name}</td> 
                      <td style={{ textAlign: "right" }}>{entry.quantity}</td> 
                      <td style={{ textAlign: "right" }}> 
                        <strong>{formatCurrency(entry.unitCost)}</strong> 
                      </td> 
                      <td style={{ textAlign: "right" }}> 
                        {diff === null ? ( 
                          <span className={styles.varNeutral}><Minus size={12} /></span> 
                        ) : diff > 0 ? ( 
                           <span className={styles.varUp}> 
                             <TrendingUp size={12} /> +{formatCurrency(diff)} 
                           </span> 
                        ) : diff < 0 ? ( 
                           <span className={styles.varDown}> 
                             <TrendingDown size={12} /> {formatCurrency(diff)} 
                           </span> 
                        ) : ( 
                          <span className={styles.varNeutral}><Minus size={12} /></span> 
                        )} 
                      </td> 
                    </tr> 
                  ) 
                })} 
              </tbody> 
            </table> 
          )} 
        </div> 
 
        <div className={styles.footer}> 
          <kbd>Esc</kbd> Cerrar 
        </div> 
      </div> 
    </div> 
  ) 
} 
