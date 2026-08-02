"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/src/shared/components/Header"
import {
  Coins, Search, User, CreditCard, Calendar, Check,
  AlertCircle, Loader2, DollarSign, FileText, ArrowRight
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import { API_BASE_URL } from "@/src/shared/config/api"
import styles from "./payments.module.css"

const API_BASE = API_BASE_URL

interface Customer {
  id: string
  name: string
  taxId?: string
  documentNumber?: string
  phone?: string
  currentDebt: number
}

interface PendingSale {
  id: string
  saleDate: string
  total: number
  remainingBalance: number
  paymentStatus: string
}

interface CustomerAccountResponse {
  customer: {
    id: string
    name: string
    creditLimit: number
    currentDebt: number
    creditAvailable: number
  }
  pendingSales: PendingSale[]
  payments: any[]
}

interface PaymentResult {
  totalApplied: number
  salesAffected: number
  payments: Array<{
    id: string
    amount: number
    saleId: string | null
    notes?: string
  }>
}

export default function ClientsPaymentsPage() {
  const { accessToken } = useAuthStore()
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  // ── States ──────────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAccountResponse | null>(null)
  
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER">("CASH")
  const [notes, setNotes] = useState("")
  
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<PaymentResult | null>(null)

  // ── Fetch Customers ────────────────────────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    if (!accessToken) return
    setLoadingCustomers(true)
    try {
      const res = await fetch(`${API_BASE}/customers?limit=100`, { headers: authHeaders })
      if (!res.ok) throw new Error("Error al cargar clientes")
      const data = await res.json()
      // Filtramos solo clientes con deuda activa
      setCustomers((data.items ?? []).filter((c: Customer) => c.currentDebt > 0))
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoadingCustomers(false)
    }
  }, [accessToken])

  useEffect(() => {
    void fetchCustomers()
  }, [fetchCustomers])

  // ── Fetch Customer Account/Pending Sales ────────────────────────────────────
  const fetchCustomerAccount = useCallback(async (id: string) => {
    if (!accessToken || !id) return
    setLoadingDetails(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/customer-payments/by-customer/${id}`, { headers: authHeaders })
      if (!res.ok) throw new Error("Error al cargar estado de cuenta del cliente")
      const data = await res.json()
      setSelectedCustomer(data)
    } catch (err: any) {
      setError(err.message)
      setSelectedCustomer(null)
    } finally {
      setLoadingDetails(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (selectedCustomerId) {
      void fetchCustomerAccount(selectedCustomerId)
    } else {
      setSelectedCustomer(null)
    }
  }, [selectedCustomerId, fetchCustomerAccount])

  // ── Handle Submit Payment ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomerId) {
      setError("Por favor, selecciona un cliente.")
      return
    }
    const cleanAmount = parseFloat(amount.replace(/\./g, ""))
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      setError("Por favor, ingresa un monto válido mayor a 0.")
      return
    }
    if (selectedCustomer && cleanAmount > selectedCustomer.customer.currentDebt) {
      setError(`El monto ingresado supera la deuda del cliente (${formatCurrency(selectedCustomer.customer.currentDebt)})`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/customer-payments/pay-to-account`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          customerId: selectedCustomerId,
          amount: cleanAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || "Error al procesar el pago")
      }

      const result = await res.json()
      setSuccessResult(result)
      
      // Reset form fields
      setAmount("")
      setNotes("")
      
      // Refresh current customer's account and general customer list
      void fetchCustomers()
      if (selectedCustomerId) {
        void fetchCustomerAccount(selectedCustomerId)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Helper formatting for currency input
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const val = e.target.value.replace(/\D/g, "")
    setAmount(val ? val.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "")
  }

  // Filter customers by search term
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.documentNumber && c.documentNumber.includes(search)) ||
    (c.taxId && c.taxId.includes(search))
  )

  const activeCustomerInfo = customers.find(c => c.id === selectedCustomerId)

  return (
    <div className={styles.pageContainer}>
      <Header title="Cobro de Deudas" />

      <div className={styles.containerGrid}>
        {/* Columna Izquierda: Formulario de Pago */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.iconContainer}>
              <Coins className={styles.icon} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Registrar Pago a Cuenta</h2>
              <p className={styles.cardSubtitle}>El cobro se distribuirá automáticamente en base a las facturas más antiguas (FIFO).</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.errorAlert}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Selector de Cliente */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Cliente deudor *</label>
              <div className={styles.selectWrapper}>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className={styles.select}
                  disabled={submitting}
                >
                  <option value="">-- Seleccionar cliente con deuda --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Debe: {formatCurrency(c.currentDebt)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Campo Monto */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Monto a cobrar (Gs.) *</label>
              <div className={styles.inputIconWrapper}>
                <span className={styles.inputPrefix}>Gs.</span>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="0"
                  value={amount}
                  onChange={handleAmountChange}
                  disabled={submitting || !selectedCustomerId}
                />
              </div>
            </div>

            {/* Método de Pago */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Método de cobro *</label>
              <div className={styles.radioGrid}>
                {(["CASH", "CARD", "TRANSFER"] as const).map((method) => (
                  <label
                    key={method}
                    className={`${styles.radioLabel} ${paymentMethod === method ? styles.radioActive : ""}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentMethod(method)}
                      className={styles.radioInput}
                      disabled={submitting}
                    />
                    <CreditCard size={16} />
                    <span>
                      {method === "CASH" ? "Efectivo" : method === "CARD" ? "Tarjeta" : "Transferencia"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Observaciones */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Observaciones</label>
              <textarea
                className={styles.textarea}
                placeholder="Notas sobre el cobro (ej: Nro transferencia, cheque, etc)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                rows={3}
                disabled={submitting}
              />
            </div>

            {/* Botón Registrar */}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting || !selectedCustomerId || !amount}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className={styles.spinner} />
                  <span>Procesando pago...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Registrar Cobro</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Columna Derecha: Estado del Cliente y Facturas Pendientes */}
        <div className={styles.card}>
          {loadingDetails ? (
            <div className={styles.loadingCenter}>
              <Loader2 size={36} className={styles.spinner} />
              <p>Cargando facturas pendientes...</p>
            </div>
          ) : selectedCustomer ? (
            <div className={styles.detailsContainer}>
              <div className={styles.detailsHeader}>
                <div className={styles.avatar}>
                  <User size={24} />
                </div>
                <div>
                  <h3 className={styles.detailsTitle}>{selectedCustomer.customer.name}</h3>
                  <p className={styles.detailsSubtitle}>Estado de cuenta de crédito</p>
                </div>
              </div>

              {/* Grid de KPIs del Cliente */}
              <div className={styles.kpiGrid}>
                <div className={`${styles.kpiCard} ${styles.kpiDebt}`}>
                  <span className={styles.kpiLabel}>Deuda total</span>
                  <span className={styles.kpiValue}>{formatCurrency(selectedCustomer.customer.currentDebt)}</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Límite de crédito</span>
                  <span className={styles.kpiValue}>{formatCurrency(selectedCustomer.customer.creditLimit)}</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Crédito disponible</span>
                  <span className={styles.kpiValue} style={{ color: "#22c55e" }}>
                    {formatCurrency(selectedCustomer.customer.creditAvailable)}
                  </span>
                </div>
              </div>

              {/* Facturas Pendientes */}
              <div className={styles.salesSection}>
                <h4 className={styles.sectionTitle}>Ventas pendientes con saldo (Antigüedad ascendente)</h4>
                {selectedCustomer.pendingSales.length === 0 ? (
                  <div className={styles.emptySales}>
                    <p>No se encontraron facturas pendientes individuales para este cliente.</p>
                  </div>
                ) : (
                  <div className={styles.salesList}>
                    {selectedCustomer.pendingSales.map((sale, idx) => (
                      <div key={sale.id} className={styles.saleItem}>
                        <div className={styles.saleMain}>
                          <div className={styles.saleIcon}>
                            <FileText size={16} />
                          </div>
                          <div>
                            <span className={styles.saleDate}>
                              {new Date(sale.saleDate).toLocaleDateString("es-PY", {
                                year: "numeric", month: "long", day: "numeric"
                              })}
                            </span>
                            <div className={styles.saleMeta}>
                              <span className={styles.saleLabel}>Total: {formatCurrency(sale.total)}</span>
                              <span className={styles.salePriority}>FIFO #{idx + 1}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.saleStatus}>
                          <span className={styles.saleRemaining}>
                            Pendiente: {formatCurrency(sale.remainingBalance)}
                          </span>
                          <span className={`${styles.badge} ${sale.paymentStatus === "PARTIAL" ? styles.badgePartial : styles.badgePending}`}>
                            {sale.paymentStatus === "PARTIAL" ? "Parcial" : "Pendiente"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrap}>
                <User size={36} className={styles.mutedIcon} />
              </div>
              <h3>Ningún cliente seleccionado</h3>
              <p>Selecciona un cliente deudor en el formulario de la izquierda para ver el desglose de su cuenta y sus facturas pendientes.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmación de Pago Exitoso */}
      {successResult && (
        <div className={styles.modalOverlay} onClick={() => setSuccessResult(null)}>
          <div className={styles.successModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.successHeader}>
              <div className={styles.successIconWrap}>
                <Check size={28} />
              </div>
              <h2 className={styles.successTitle}>Pago Aplicado con Éxito</h2>
              <p className={styles.successSubtitle}>El cobro se ha procesado y distribuido correctamente.</p>
            </div>

            <div className={styles.successBody}>
              <div className={styles.successKpiGrid}>
                <div className={styles.successKpi}>
                  <span className={styles.successKpiLabel}>Total cobrado</span>
                  <span className={styles.successKpiValue}>{formatCurrency(successResult.totalApplied)}</span>
                </div>
                <div className={styles.successKpi}>
                  <span className={styles.successKpiLabel}>Ventas afectadas</span>
                  <span className={styles.successKpiValue}>{successResult.salesAffected}</span>
                </div>
              </div>

              <div className={styles.distributionSection}>
                <span className={styles.distTitle}>Detalle de Distribución</span>
                <div className={styles.distList}>
                  {successResult.payments.map((p, idx) => {
                    const linkedSale = selectedCustomer?.pendingSales.find(s => s.id === p.saleId)
                    return (
                      <div key={p.id} className={styles.distItem}>
                        <div className={styles.distLeft}>
                          <span className={styles.distIndex}>#{idx + 1}</span>
                          <div>
                            <span className={styles.distName}>
                              {p.saleId ? "Aplicado a factura" : "Excedente a cuenta general"}
                            </span>
                            {linkedSale && (
                              <span className={styles.distSub}>
                                Factura del {new Date(linkedSale.saleDate).toLocaleDateString("es-PY")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={styles.distAmount}>
                          <span className={styles.distApplied}>+ {formatCurrency(p.amount)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSuccessResult(null)}
              className={styles.closeModalBtn}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
