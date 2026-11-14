"use client"

import { useState, type ReactNode } from "react"
import {
  AlertCircle, Banknote, Calendar, CheckCircle2, CreditCard, Hash,
  Loader2, Package, Receipt, User, X, XCircle,
} from "lucide-react"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { useCommercialCapabilities } from "@/src/shared/hooks/useCommercialCapabilities"
import { ConfirmDialog } from "@/src/shared/components/ConfirmDialog"
import controls from "@/src/shared/styles/detailFormControls.module.css"
import { DetailModalTabs, type DetailModalTab } from "@/src/shared/components/DetailModalTabs"
import layout from "@/src/shared/styles/DetailModalLayout.module.css"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
import styles from "../pages/SalesHistoryPage.module.css"
import { SaleReturnPanel } from "./SaleReturnPanel"

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
  accessToken: string
  onSaleUpdated: () => void
  onClose: () => void
  loadingDetail: boolean
  detailError: string | null
  cancelError: string | null
  cancelling: boolean
  restoring: boolean
  onCancel: (reason: string) => void
  onRestore: (reason: string) => void
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
  COMPLETED: { label: "Completada", icon: <CheckCircle2 size={12} />, className: styles.statusCompleted },
  CANCELLED: { label: "Anulada", icon: <XCircle size={12} />, className: styles.statusCancelled },
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PY", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  })
}

function formatQuantity(quantity: number, unitType: string) {
  return unitType === "UNIT" ? String(quantity) : quantity % 1 === 0 ? String(quantity) : quantity.toFixed(3)
}

export function SaleDetailModal({
  selectedSale,
  accessToken,
  onSaleUpdated,
  onClose,
  loadingDetail,
  detailError,
  cancelError,
  cancelling,
  restoring,
  onCancel,
  onRestore,
}: SaleDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailModalTab>("summary")
  const [pendingAction, setPendingAction] = useState<"cancel" | "restore" | null>(null)
  const [actionReason, setActionReason] = useState("")
  const { capabilities, loading: capabilitiesLoading, error: capabilitiesError } = useCommercialCapabilities(accessToken)
  const detailId = `sale-detail-${selectedSale.id.slice(0, 8)}`
  const paymentLabel = selectedSale.paymentMethod === "CREDIT"
    ? "Crédito"
    : selectedSale.paymentMethod === "CASH"
      ? "Contado (efectivo)"
      : selectedSale.paymentMethod === "CARD"
        ? "Tarjeta"
        : selectedSale.paymentMethod === "TRANSFER"
          ? "Transferencia"
          : selectedSale.paymentMethod
  const blockReasonId = `${detailId}-action-reason`
  const saleActionCapability = selectedSale.status === "COMPLETED"
    ? capabilities?.saleCancellations
    : capabilities?.saleRestorations
  const saleActionEnabled = saleActionCapability?.enabled === true
  const saleActionReason = saleActionEnabled
    ? null
    : saleActionCapability?.reason || capabilitiesError || (capabilitiesLoading ? "Verificando la disponibilidad de esta acción…" : "Esta acción no está disponible temporalmente.")

  return (
    <div className={tableStyles.modalOverlay} onClick={onClose}>
      <div data-pos-modal className={styles.detailModal} onClick={event => event.stopPropagation()}>
        <header className={styles.detailModalHeader}>
          <div className={styles.detailModalHeaderLeft}>
            <Receipt size={18} className={styles.detailModalIcon} aria-hidden="true" />
            <div>
              <h2 className={styles.detailModalTitle}>Detalle de venta</h2>
              <p className={styles.detailModalSubtitle}>#{selectedSale.id.slice(0, 8)}</p>
            </div>
          </div>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="Cerrar detalle de venta">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <DetailModalTabs id={detailId} value={activeTab} onChange={setActiveTab} disabled={loadingDetail || Boolean(detailError)} />

        <div className={styles.detailModalBody}>
          {loadingDetail ? (
            <div className={styles.detailLoading}><Loader2 size={26} className={tableStyles.spinner} /> Cargando detalle…</div>
          ) : detailError ? (
            <div className={styles.detailError} role="alert"><AlertCircle size={16} />{detailError}</div>
          ) : (
            <>
              <section
                id={`${detailId}-summary-panel`}
                role="tabpanel"
                aria-labelledby={`${detailId}-summary-tab`}
                hidden={activeTab !== "summary"}
                className={`${layout.tabPanel} ${styles.summaryPanel}`}
              >
                <div className={styles.receiptHeader}>
                  <div className={styles.receiptHeaderGrid}>
                    <InfoBlock icon={<Hash size={14} />} label="ID de venta" value={selectedSale.id} mono />
                    <InfoBlock icon={<Calendar size={14} />} label="Fecha" value={formatDateTime(selectedSale.saleDate)} />
                    <InfoBlock icon={<CheckCircle2 size={14} />} label="Estado" value={(
                      <span className={`${styles.statusBadge} ${STATUS_CONFIG[selectedSale.status]?.className ?? styles.statusCompleted}`}>
                        {STATUS_CONFIG[selectedSale.status]?.icon}{STATUS_CONFIG[selectedSale.status]?.label ?? selectedSale.status}
                      </span>
                    )} />
                    <InfoBlock icon={selectedSale.paymentMethod === "CASH" ? <Banknote size={14} /> : <CreditCard size={14} />} label="Método de pago" value={paymentLabel} />
                    <InfoBlock icon={<User size={14} />} label="Cliente" value={(
                      <>
                        {selectedSale.customer?.name ?? "Consumidor Final"}
                        {selectedSale.customer?.documentNumber ? ` · CI ${selectedSale.customer.documentNumber}` : selectedSale.customer?.taxId ? ` · RUC ${selectedSale.customer.taxId}` : ""}
                      </>
                    )} full />
                    {selectedSale.paymentMethod === "CREDIT" && (
                      <>
                        <InfoBlock icon={<CreditCard size={14} />} label="Seña registrada" value={formatCurrency(selectedSale.customerPayments?.find(payment => payment.paymentMethod === "CREDIT")?.amount ?? 0)} />
                        <InfoBlock icon={<CreditCard size={14} />} label="Saldo pendiente" value={`${formatCurrency(selectedSale.remainingBalance)} · ${selectedSale.paymentStatus === "PAID" ? "Pagado" : selectedSale.paymentStatus === "PARTIAL" ? "Parcial" : "Pendiente"}`} />
                      </>
                    )}
                    {selectedSale.notes && <InfoBlock icon={<Receipt size={14} />} label="Observaciones" value={selectedSale.notes} full />}
                  </div>
                </div>

                <section className={styles.receiptItemsSection} aria-labelledby={`${detailId}-items-heading`}>
                  <div className={styles.receiptItemsTitle} id={`${detailId}-items-heading`}>
                    <Package size={14} aria-hidden="true" /><span>Productos originales</span>
                    <span className={styles.receiptItemsCount}>{selectedSale.items?.length ?? 0}</span>
                  </div>
                  <div className={styles.detailTableWrap}>
                    <table className={styles.receiptItemsTable}>
                      <thead><tr><th>#</th><th>Código</th><th>Descripción</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
                      <tbody>
                        {(selectedSale.items ?? []).map((item, index) => (
                          <tr key={item.id}>
                            <td>{index + 1}</td>
                            <td><span className={styles.itemSkuChip}>{item.product?.barcode || item.product?.sku || "—"}</span></td>
                            <td className={styles.productNameCell}>
                              <span title={item.product?.name}>{item.product?.name}</span>
                              <small className={styles.itemPriceTypeChip}>{item.priceType === "WHOLESALE" ? "Mayorista" : "Minorista"}</small>
                            </td>
                            <td className={styles.numericCell}>{formatQuantity(item.quantity, item.product?.unitType)}</td>
                            <td className={styles.numericCell}>{formatCurrency(item.unitPrice)}</td>
                            <td className={styles.numericCell}>{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className={styles.receiptTotalFooter}>
                  <div className={styles.receiptTotalDivider} />
                  <div className={styles.receiptTotalRow}><span className={styles.receiptTotalLabel}>TOTAL DE LA VENTA</span><span className={styles.receiptTotalValue}>{formatCurrency(selectedSale.total)}</span></div>
                </div>
              </section>

              <section
                id={`${detailId}-returns-panel`}
                role="tabpanel"
                aria-labelledby={`${detailId}-returns-tab`}
                hidden={activeTab !== "returns"}
                className={`${layout.tabPanel} ${styles.returnsPanel}`}
              >
                {selectedSale.status === "COMPLETED" ? (
                  <SaleReturnPanel key={selectedSale.id} sale={selectedSale} accessToken={accessToken} onChanged={onSaleUpdated} />
                ) : (
                  <p className={styles.returnBlockedNotice} role="status">Esta venta está anulada; no se pueden registrar nuevas devoluciones.</p>
                )}
              </section>
            </>
          )}
        </div>

        <footer className={layout.footer}>
          <div className={layout.footerMessage}>
            {activeTab === "summary" && !loadingDetail && !detailError && !saleActionEnabled && (
              <span id={blockReasonId}>{saleActionReason}</span>
            )}
            {cancelError && <span className={styles.cancelError} role="alert">{cancelError}</span>}
          </div>
          <div className={layout.footerActions}>
            {activeTab === "summary" && selectedSale.status === "COMPLETED" && (
              <button type="button" className={`${layout.footerButton} ${layout.footerButtonDanger}`} onClick={() => { setActionReason(""); setPendingAction("cancel") }} disabled={capabilitiesLoading || !saleActionEnabled || cancelling} aria-describedby={!saleActionEnabled ? blockReasonId : undefined}>
                {cancelling ? <Loader2 size={14} className={tableStyles.spinner} /> : <XCircle size={14} />} Anular venta
              </button>
            )}
            {activeTab === "summary" && selectedSale.status === "CANCELLED" && (
              <button type="button" className={`${layout.footerButton} ${layout.footerButtonSuccess}`} onClick={() => { setActionReason(""); setPendingAction("restore") }} disabled={capabilitiesLoading || !saleActionEnabled || restoring} aria-describedby={!saleActionEnabled ? blockReasonId : undefined}>
                {restoring ? <Loader2 size={14} className={tableStyles.spinner} /> : <CheckCircle2 size={14} />} Restaurar venta
              </button>
            )}
            <button type="button" className={layout.footerButton} onClick={onClose}>Cerrar</button>
          </div>
        </footer>
      </div>
      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction === "restore" ? "Restaurar venta" : "Anular venta"}
        message={pendingAction === "restore"
          ? "La restauración solo está disponible si la venta fue anulada por error y no tiene devoluciones. Registrá el motivo para continuar."
          : "La anulación es solo para una venta errónea sin pagos recibidos ni devoluciones. Registrá el motivo para continuar."}
        confirmText={pendingAction === "restore" ? "Restaurar" : "Anular venta"}
        type={pendingAction === "restore" ? "warning" : "danger"}
        loading={cancelling || restoring}
        confirmDisabled={actionReason.trim().length < 5}
        onConfirm={() => {
          if (pendingAction === "restore") onRestore(actionReason.trim())
          else if (pendingAction === "cancel") onCancel(actionReason.trim())
        }}
        onCancel={() => setPendingAction(null)}
      >
        <label className={controls.label}>
          Motivo (mínimo 5 caracteres)
          <textarea className={controls.control} rows={3} maxLength={500} value={actionReason} onChange={event => setActionReason(event.target.value)} autoFocus />
        </label>
      </ConfirmDialog>
    </div>
  )
}

function InfoBlock({ icon, label, value, full = false, mono = false }: { icon: ReactNode; label: string; value: ReactNode; full?: boolean; mono?: boolean }) {
  return (
    <div className={`${styles.receiptInfoBlock} ${full ? styles.receiptInfoBlockFull : ""}`}>
      <div className={styles.receiptInfoRow}>
        <span className={styles.receiptInfoIcon} aria-hidden="true">{icon}</span>
        <div className={styles.infoText}>
          <span className={styles.receiptInfoLabel}>{label}</span>
          <span className={`${styles.receiptInfoValue} ${mono ? styles.receiptIdValue : ""}`} title={typeof value === "string" ? value : undefined}>{value}</span>
        </div>
      </div>
    </div>
  )
}
