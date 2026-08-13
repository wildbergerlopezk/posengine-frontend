"use client"

import type React from "react"
import { Loader2, Package, Eye, CheckCircle2, XCircle } from "lucide-react"
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

interface SalesHistoryTableProps {
  sales: Sale[]
  loading: boolean
  error: string | null
  totalItems: number
  onOpenDetail: (sale: Sale) => void
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

export function SalesHistoryTable({
  sales,
  loading,
  error,
  totalItems,
  onOpenDetail,
}: SalesHistoryTableProps) {
  return (
    <div className={tableStyles.tableCard}>
      <div className={styles.tableToolbar}>
        <span className={styles.tableTitle}>
          Ventas <span className={styles.tableCount}>{totalItems}</span>
        </span>
      </div>

      <table className={`${tableStyles.table} ${styles.historyTable}`}>
        <thead className={tableStyles.tableHeader}>
          <tr>
            <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 170 }}>ID Venta</th>
            <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 150 }}>Fecha</th>
            <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 120 }}>Tipo de venta</th>
            <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 180 }}>Cliente</th>
            <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 70 }}>Items</th>
            <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 110 }}>Estado</th>
            <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight} ${styles.headerCellOverride}`} style={{ width: 130 }}>Total</th>
            <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 60 }} />
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8}>
                <div className={tableStyles.emptyState}>
                  <Loader2 size={28} className={tableStyles.spinner} />
                </div>
              </td>
            </tr>
          ) : sales.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <div className={tableStyles.emptyState}>
                  <Package size={36} className={tableStyles.emptyStateIcon} />
                  <p className={tableStyles.emptyStateTitle}>Sin ventas registradas</p>
                  <p>No se encontraron ventas con los filtros seleccionados</p>
                </div>
              </td>
            </tr>
          ) : (
            sales.map(sale => {
              const sc = STATUS_CONFIG[sale.status] ?? STATUS_CONFIG.COMPLETED
              return (
                <tr key={sale.id} className={tableStyles.tableRow}>
                  <td className={tableStyles.tableCell}>
                    <span className={styles.saleIdChip}>#{sale.id.slice(0, 8)}</span>
                  </td>
                  <td className={tableStyles.tableCell}>
                    <span className={styles.dateText}>{formatDateTime(sale.saleDate)}</span>
                  </td>
                  <td className={tableStyles.tableCell}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.25rem 0.6rem",
                      borderRadius: "9999px",
                      fontSize: "0.725rem",
                      fontWeight: 600,
                      backgroundColor: sale.paymentMethod === "CREDIT" ? "rgba(59, 130, 246, 0.12)" : "rgba(34, 197, 94, 0.12)",
                      color: sale.paymentMethod === "CREDIT" ? "#3b82f6" : "#22c55e",
                    }}>
                      {sale.paymentMethod === "CREDIT" ? "Crédito" : "Contado"}
                    </span>
                  </td>
                  <td className={tableStyles.tableCell}>
                    <span style={{ fontSize: "0.825rem" }}>
                      {sale.customer?.name || "Consumidor Final"}
                    </span>
                  </td>
                  <td className={tableStyles.tableCell}>
                    <span className={styles.itemsCountChip}>{sale.items?.length ?? "—"}</span>
                  </td>
                  <td className={tableStyles.tableCell}>
                    <span className={`${styles.statusBadge} ${sc.className}`}>
                      {sc.icon} {sc.label}
                    </span>
                  </td>
                  <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                    <strong style={{ fontSize: "0.875rem" }}>{formatCurrency(sale.total)}</strong>
                  </td>
                  <td className={tableStyles.tableCell}>
                    <button
                      type="button"
                      className={styles.viewBtn}
                      onClick={() => onOpenDetail(sale)}
                      title="Ver detalle de la venta"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
