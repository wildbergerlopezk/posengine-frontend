"use client"

import type React from "react"
import { AlertCircle } from "lucide-react"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import styles from "../pages/SalesPage.module.css"

interface Customer {
  id: string
  name: string
  creditEnabled: boolean
  creditLimit: number
  currentDebt: number
  documentNumber?: string
}

interface SaleConfirmModalProps {
  total: number
  paymentMethod: "CASH" | "CREDIT"
  selectedCustomer: Customer | null
  amountPaid: number
  onAmountPaidChange: (amount: number) => void
  confirmSelectedBtn: "accept" | "cancel"
  amountPaidInputRef: React.RefObject<HTMLInputElement | null>
  confirmAcceptRef: React.RefObject<HTMLButtonElement | null>
  confirmCancelRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
  onConfirm: () => void
}

export function SaleConfirmModal({
  total,
  paymentMethod,
  selectedCustomer,
  amountPaid,
  onAmountPaidChange,
  confirmSelectedBtn,
  amountPaidInputRef,
  confirmAcceptRef,
  confirmCancelRef,
  onClose,
  onConfirm,
}: SaleConfirmModalProps) {
  const isCreditOverLimit =
    paymentMethod === "CREDIT" &&
    selectedCustomer !== null &&
    selectedCustomer.currentDebt + Math.max(0, total - amountPaid) > selectedCustomer.creditLimit

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.confirmModal}>
        <div className={styles.confirmIcon}>
          <AlertCircle size={40} />
        </div>
        <h2 className={styles.confirmTitle}>¿Confirmar venta?</h2>
        <p className={styles.confirmDescription}>
          Total: <strong>{formatCurrency(total)}</strong>
        </p>

        {paymentMethod === "CREDIT" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", marginBottom: "1rem", textAlign: "left" }}>
            <div>
              <span style={{ fontSize: "0.825rem", color: "var(--color-muted-foreground)", fontWeight: 600, display: "block" }}>
                Cliente seleccionado
              </span>
              <div style={{ fontSize: "1rem", fontWeight: 700, padding: "0.5rem", borderRadius: "0.25rem", background: "var(--color-muted, #f3f4f6)", color: "var(--color-foreground)" }}>
                {selectedCustomer ? selectedCustomer.name : "Consumidor Final"}
              </div>
            </div>
            <div>
              <label style={{ fontSize: "0.825rem", color: "var(--color-muted-foreground)", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Monto abonado / Seña (Gs.)
              </label>
              <input
                id="amount-paid-input"
                ref={amountPaidInputRef as any}
                type="number"
                min="0"
                max={total}
                value={amountPaid || ""}
                onChange={e => onAmountPaidChange(Number(e.target.value) || 0)}
                placeholder="0"
                style={{
                  width: "100%",
                  height: "2.5rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-background)",
                  color: "var(--color-foreground)",
                  padding: "0 0.5rem",
                  fontSize: "0.875rem"
                }}
              />
            </div>
          </div>
        )}

        <div className={styles.confirmButtons}>
          <button
            ref={confirmCancelRef as any}
            className={`${styles.confirmCancel} ${confirmSelectedBtn === "cancel" ? styles.buttonFocused : ""}`}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            ref={confirmAcceptRef as any}
            className={`${styles.confirmAccept} ${confirmSelectedBtn === "accept" ? styles.buttonFocused : ""}`}
            disabled={isCreditOverLimit}
            style={{
              opacity: isCreditOverLimit ? 0.5 : 1,
              cursor: isCreditOverLimit ? "not-allowed" : "pointer"
            }}
            onClick={onConfirm}
          >
            Confirmar
          </button>
        </div>
        <div className={styles.confirmHint}>
          <kbd>←→</kbd> Navegar <kbd>Enter</kbd> Confirmar <kbd>Esc</kbd> Cancelar
        </div>
      </div>
    </div>
  )
}
