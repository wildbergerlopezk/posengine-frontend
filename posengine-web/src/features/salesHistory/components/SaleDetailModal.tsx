"use client"

import type React from "react"
import {
  Receipt, X, Hash, Calendar, CheckCircle2, XCircle, CreditCard, User,
  AlertCircle, Package, Printer, Plus, Loader2
} from "lucide-react"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
import styles from "../pages/SalesHistoryPage.module.css"

type SaleStatus = "COMPLETED" | "CANCELLED"

interface Product {
  id: string
  name: string
  barcode?: string
  sku?: string
  unitType: string
}

interface SaleItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  total: number
  priceType: string
  product: Product
}

interface Sale {
  id: string
  saleDate: string
  total: number
  status: SaleStatus
  paymentMethod: string
  paymentStatus: string
  remainingBalance: number
  customer?: { id: string; name: string; documentNumber?: string; taxId?: string }
  notes?: string
  createdAt: string
  cashSession?: { id: string; openedAt: string; status: string }
  items?: SaleItem[]
  customerPayments?: Array<{ id: string; amount: number; paymentMethod: string; paymentDate: string }>
}

interface SaleDetailModalProps {
  selectedSale: Sale
  onClose: () => void
  loadingDetail: boolean
  detailError: string | null
  cancelError: string | null
  cancelling: boolean
  restoring: boolean
  onCancel: () => void
  onRestore: () => void
  // Control Interno & Print Props
  internalReceipt: any | null
  checkingReceipt: boolean
  companies: any[]
  selectedCompanyId: string
  emittingReceipt: boolean
  printingReceipt: boolean
  onEmitReceipt: () => void
  onPrintReceipt: () => void
}

const STATUS_CONFIG: Record<SaleStatus, { label: string; icon: React.ReactNode; className: string }> = {
  COMPLETED: {
    label: "Completada",
    icon: <CheckCircle2 size={12} />,
    className: styles.statusCompleted,
  },
  CANCELLED: {
    label: "Anulada",
    icon: <XCircle size={12} />,
    className: styles.statusCancelled,
  },
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PY", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  })
}

function formatQuantity(qty: number, unitType: string) {
  return unitType === "UNIT" ? String(qty) : qty % 1 === 0 ? String(qty) : qty.toFixed(3)
}

export function SaleDetailModal({
  selectedSale,
  onClose,
  loadingDetail,
  detailError,
  cancelError,
  cancelling,
  restoring,
  onCancel,
  onRestore,
  internalReceipt,
  checkingReceipt,
  companies,
  selectedCompanyId,
  emittingReceipt,
  printingReceipt,
  onEmitReceipt,
  onPrintReceipt,
}: SaleDetailModalProps) {
  return (
    <div className={tableStyles.modalOverlay} onClick={onClose}>
      <div className={styles.detailModal} onClick={e => e.stopPropagation()}>

        <div className={styles.detailModalHeader}>
          <div className={styles.detailModalHeaderLeft}>
            <Receipt size={18} className={styles.detailModalIcon} />
            <div>
              <h2 className={styles.detailModalTitle}>Detalle de venta</h2>
              <p className={styles.detailModalSubtitle}>#{selectedSale.id.slice(0, 8)}</p>
            </div>
          </div>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.detailModalBody}>
          {loadingDetail ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
              <Loader2 size={32} className={tableStyles.spinner} />
            </div>
          ) : detailError ? (
            <div className={tableStyles.errorBanner} style={{ margin: "1rem" }}>
              <AlertCircle size={16} />
              {detailError}
            </div>
          ) : (
            <>
              {/* Info header */}
              <div className={styles.receiptHeader}>
                <div className={styles.receiptHeaderGrid}>
                  <div className={styles.receiptInfoBlock}>
                    <div className={styles.receiptInfoRow}>
                      <Hash size={14} className={styles.receiptInfoIcon} />
                      <div>
                        <span className={styles.receiptInfoLabel}>ID de venta</span>
                        <span className={`${styles.receiptInfoValue} ${styles.receiptIdValue}`}>{selectedSale.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.receiptInfoBlock}>
                    <div className={styles.receiptInfoRow}>
                      <Calendar size={14} className={styles.receiptInfoIcon} />
                      <div>
                        <span className={styles.receiptInfoLabel}>Fecha</span>
                        <span className={styles.receiptInfoValue}>{formatDateTime(selectedSale.saleDate)}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.receiptInfoBlock}>
                    <div className={styles.receiptInfoRow}>
                      <CheckCircle2 size={14} className={styles.receiptInfoIcon} />
                      <div>
                        <span className={styles.receiptInfoLabel}>Estado</span>
                        <span className={`${styles.statusBadge} ${STATUS_CONFIG[selectedSale.status]?.className ?? styles.statusCompleted}`}>
                          {STATUS_CONFIG[selectedSale.status]?.icon}
                          {STATUS_CONFIG[selectedSale.status]?.label ?? selectedSale.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.receiptInfoBlock}>
                    <div className={styles.receiptInfoRow}>
                      <CreditCard size={14} className={styles.receiptInfoIcon} />
                      <div>
                        <span className={styles.receiptInfoLabel}>Método de pago</span>
                        <span className={styles.receiptInfoValue} style={{ fontWeight: 600, color: selectedSale.paymentMethod === "CREDIT" ? "var(--color-primary)" : "inherit" }}>
                          {selectedSale.paymentMethod === "CREDIT" ? "Crédito" : selectedSale.paymentMethod === "CASH" ? "Contado (Efectivo)" : selectedSale.paymentMethod === "CARD" ? "Tarjeta" : selectedSale.paymentMethod === "TRANSFER" ? "Transferencia" : selectedSale.paymentMethod}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.receiptInfoBlockFull} style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", width: "100%", margin: "0.5rem 0" }}>
                    <div className={styles.receiptInfoRow} style={{ minWidth: 200 }}>
                      <User size={14} className={styles.receiptInfoIcon} />
                      <div>
                        <span className={styles.receiptInfoLabel}>Cliente asociado</span>
                        <span className={styles.receiptInfoValue} style={{ fontWeight: 600 }}>
                          {selectedSale.customer ? (
                            <>
                              {selectedSale.customer.name} {selectedSale.customer.documentNumber ? `(CI: ${selectedSale.customer.documentNumber})` : selectedSale.customer.taxId ? `(RUC: ${selectedSale.customer.taxId})` : ""}
                            </>
                          ) : (
                            "Consumidor Final"
                          )}
                        </span>
                      </div>
                    </div>

                    {selectedSale.paymentMethod === "CREDIT" && (
                      <>
                        <div className={styles.receiptInfoRow} style={{ minWidth: 200 }}>
                          <AlertCircle size={14} className={styles.receiptInfoIcon} />
                          <div>
                            <span className={styles.receiptInfoLabel}>Monto abonado / Seña (Gs.)</span>
                            <span className={styles.receiptInfoValue} style={{ fontWeight: 600, color: "var(--color-primary)" }}>
                              {formatCurrency(selectedSale.customerPayments?.find(p => p.paymentMethod === "CREDIT")?.amount || 0)}
                            </span>
                          </div>
                        </div>

                        <div className={styles.receiptInfoRow} style={{ minWidth: 220 }}>
                          <AlertCircle size={14} className={styles.receiptInfoIcon} />
                          <div>
                            <span className={styles.receiptInfoLabel}>Saldo pendiente de pago</span>
                            <span className={styles.receiptInfoValue} style={{ color: selectedSale.remainingBalance > 0 ? "#ef4444" : "#22c55e", fontWeight: 600 }}>
                              {formatCurrency(selectedSale.remainingBalance)} (Estado: {selectedSale.paymentStatus === "PAID" ? "Pagado" : selectedSale.paymentStatus === "PARTIAL" ? "Parcial" : "Pendiente"})
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {selectedSale.notes && (
                    <div className={`${styles.receiptInfoBlock} ${styles.receiptInfoBlockFull}`}>
                      <div className={styles.receiptInfoRow}>
                        <Receipt size={14} className={styles.receiptInfoIcon} />
                        <div>
                          <span className={styles.receiptInfoLabel}>Observaciones</span>
                          <span className={styles.receiptInfoValue}>{selectedSale.notes}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className={styles.receiptItemsSection}>
                <div className={styles.receiptItemsTitle}>
                  <Package size={14} />
                  <span>Productos</span>
                  {selectedSale.items && (
                    <span className={styles.receiptItemsCount}>{selectedSale.items.length}</span>
                  )}
                </div>

                <table className={styles.receiptItemsTable}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th style={{ width: 100 }}>Código</th>
                      <th>Descripción</th>
                      <th style={{ width: 60, textAlign: "right" }}>Cant.</th>
                      <th style={{ width: 110, textAlign: "right" }}>Precio unit.</th>
                      <th style={{ width: 120, textAlign: "right" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedSale.items ?? []).map((item, idx) => (
                      <tr key={item.id}>
                        <td>{idx + 1}</td>
                        <td>
                          <span className={styles.itemSkuChip}>
                            {item.product?.barcode || item.product?.sku || "—"}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.product?.name}</div>
                          <span className={styles.itemPriceTypeChip}>
                            {item.priceType === "WHOLESALE" ? "Mayorista" : "Minorista"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {formatQuantity(item.quantity, item.product?.unitType)}
                        </td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(item.unitPrice)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.receiptTotalFooter}>
                <div className={styles.receiptTotalDivider} />
                <div className={styles.receiptTotalRow}>
                  <span className={styles.receiptTotalLabel}>TOTAL</span>
                  <span className={styles.receiptTotalValue}>{formatCurrency(selectedSale.total)}</span>
                </div>
              </div>

              {/* Comprobante de Control Interno Section comentada por desuso */}
              {/* {selectedSale.status === "COMPLETED" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1rem 1.5rem", borderTop: "1px dashed var(--color-border)", marginTop: "1rem" }}>
                  <span style={{ fontSize: "0.825rem", color: "var(--color-muted-foreground)", fontWeight: 700, textTransform: "uppercase" }}>
                    Comprobante de Control Interno
                  </span>
                  {checkingReceipt ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--color-muted-foreground)" }}>
                      <Loader2 size={14} className={tableStyles.spinner} />
                      <span>Verificando comprobantes asociados...</span>
                    </div>
                  ) : internalReceipt ? (
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      <span style={{ fontSize: "0.875rem", color: "var(--color-foreground)" }}>
                        Nro: <strong>CI-{String(internalReceipt.docNumber).padStart(7, "0")}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={onPrintReceipt}
                        disabled={printingReceipt}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          background: "var(--color-primary)",
                          color: "var(--color-primary-foreground)",
                          padding: "0.375rem 0.75rem",
                          borderRadius: "0.375rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          border: "none"
                        }}
                      >
                        {printingReceipt ? <Loader2 size={12} className={tableStyles.spinner} /> : <Printer size={12} />}
                        Imprimir PDF
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      {companies.length > 0 ? (
                        <>
                          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-foreground)" }}>
                            {companies.find((c: any) => c.id === selectedCompanyId)?.legalName || "Cargando empresa..."}
                          </span>
                          <button
                            type="button"
                            onClick={onEmitReceipt}
                            disabled={emittingReceipt}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.375rem",
                              background: "none",
                              border: "1px solid var(--color-border)",
                              color: "var(--color-foreground)",
                              padding: "0.375rem 0.75rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer"
                            }}
                          >
                            {emittingReceipt ? <Loader2 size={12} className={tableStyles.spinner} /> : <Plus size={12} />}
                            Emitir Control Interno
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "var(--color-muted-foreground)", fontStyle: "italic" }}>
                          Crea una empresa en la configuración para emitir comprobantes.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )} */}

              {cancelError && (
                <div className={styles.cancelError}>
                  <AlertCircle size={14} />{cancelError}
                </div>
              )}

              {selectedSale.status === "COMPLETED" && (
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={onCancel}
                    disabled={cancelling}
                  >
                    {cancelling
                      ? <><Loader2 size={15} className={tableStyles.spinner} /> Anulando…</>
                      : <><XCircle size={15} /> Anular venta</>
                    }
                  </button>
                </div>
              )}

              {selectedSale.status === "CANCELLED" && (
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.restoreBtn}
                    onClick={onRestore}
                    disabled={restoring}
                  >
                    {restoring
                      ? <><Loader2 size={15} className={tableStyles.spinner} /> Restaurando…</>
                      : <><CheckCircle2 size={15} /> Desanular venta</>
                    }
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
