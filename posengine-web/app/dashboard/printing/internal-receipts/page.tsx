"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import { toast } from "sonner"
import styles from "./internal-receipts.module.css"
import {
  Printer,
  Trash2,
  Plus,
  Search,
  Building2,
  User,
  FileText,
  X,
  AlertTriangle,
  RefreshCw,
  Download
} from "lucide-react"

interface InternalReceipt {
  id: string
  tenantId: string
  companyId: string
  saleId: string
  customerId: string | null
  docNumber: number
  total: number
  voided: boolean
  voidedAt: string | null
  voidedReason: string | null
  createdAt: string
  snapshot: {
    company: {
      legalName: string
      taxId: string
    }
    customer: {
      name: string
    } | null
    sale: {
      id: string
      saleDate: string
      status: string
      total: number
    }
  }
}

interface Company {
  id: string
  legalName: string
  taxId: string
}

interface Sale {
  id: string
  saleDate: string
  status: string
  total: number
  customer?: {
    id: string
    name: string
  } | null
}

export default function InternalReceiptsPage() {
  const { accessToken } = useAuthStore()

  // List States
  const [receipts, setReceipts] = useState<InternalReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const LIMIT = 10

  // Filters
  const [companyFilter, setCompanyFilter] = useState("")
  const [voidedFilter, setVoidedFilter] = useState<"ALL" | "ACTIVE" | "VOIDED">("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Form / Creation States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [selectedSaleId, setSelectedSaleId] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // PDF Preview States
  const [previewReceipt, setPreviewReceipt] = useState<InternalReceipt | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)

  // Void States
  const [isVoidOpen, setIsVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState("")
  const [voidingId, setVoidingId] = useState<string | null>(null)

  // Fetch Receipts
  const fetchReceipts = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      })
      if (companyFilter) params.set("companyId", companyFilter)
      if (voidedFilter === "VOIDED") params.set("voided", "true")
      if (voidedFilter === "ACTIVE") params.set("voided", "false")
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const res = await fetch(`${API_BASE_URL}/internal-receipts?${params}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!res.ok) throw new Error("Error al cargar comprobantes")
      const data = await res.json()
      setReceipts(data.items ?? [])
      setTotalItems(data.total ?? 0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al conectar con el servidor")
    } finally {
      setLoading(false)
    }
  }, [page, companyFilter, voidedFilter, dateFrom, dateTo, accessToken])

  // Fetch Companies & Sales for creation
  const loadCreationData = async () => {
    if (!accessToken) return
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      }
      const [companiesRes, salesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/companies`, { headers }),
        fetch(`${API_BASE_URL}/sales?limit=100`, { headers }),
      ])

      if (companiesRes.ok) {
        const compData = await companiesRes.json()
        const compList = compData.items || (Array.isArray(compData) ? compData : [])
        setCompanies(compList)
        if (compList.length > 0) setSelectedCompanyId(compList[0].id)
      }

      if (salesRes.ok) {
        const salesData = await salesRes.json()
        const activeSales = (salesData.items || []).filter((s: Sale) => s.status !== "CANCELLED")
        setSales(activeSales)
      }
    } catch (error) {
      console.error("Error al cargar datos auxiliares", error)
    }
  }

  useEffect(() => {
    if (accessToken) {
      fetchReceipts()
    }
  }, [fetchReceipts, accessToken])

  useEffect(() => {
    if (isCreateOpen && accessToken) {
      loadCreationData()
    }
  }, [isCreateOpen, accessToken])

  // Create receipt handler
  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompanyId || !selectedSaleId || !accessToken) {
      toast.error("Por favor completa los campos requeridos")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/internal-receipts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          saleId: selectedSaleId,
          customerId: selectedCustomerId || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Error al emitir comprobante")
      }

      toast.success("Comprobante interno emitido con éxito")
      setIsCreateOpen(false)
      setSelectedSaleId("")
      setSelectedCustomerId("")
      fetchReceipts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al emitir")
    } finally {
      setSubmitting(false)
    }
  }

  // Void receipt handler
  const handleVoidReceipt = async () => {
    if (!voidingId || !accessToken) return
    try {
      const res = await fetch(`${API_BASE_URL}/internal-receipts/${voidingId}/void`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ reason: voidReason }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Error al anular comprobante")
      }

      toast.success("Comprobante anulado correctamente")
      setIsVoidOpen(false)
      setVoidReason("")
      setVoidingId(null)
      fetchReceipts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular")
    }
  }

  // Preview PDF from backend
  const handlePreviewPdf = async (receipt: InternalReceipt) => {
    setPreviewReceipt(receipt)
    setLoadingPdf(true)
    setPdfUrl(null)
    try {
      const res = await fetch(`${API_BASE_URL}/internal-receipts/${receipt.id}/pdf`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!res.ok) throw new Error("No se pudo obtener el PDF del servidor")
      const blob = await res.blob()
      setPdfUrl(URL.createObjectURL(blob))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar PDF")
      setPreviewReceipt(null)
    } finally {
      setLoadingPdf(false)
    }
  }

  // Print PDF from iframe
  const handlePrintPdf = () => {
    const iframe = document.getElementById("pdf-iframe") as HTMLIFrameElement
    if (iframe) {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (e) {
        // Fallback: open print view in a new window/tab
        const printWindow = window.open(pdfUrl || '')
        if (printWindow) {
          printWindow.print()
        }
      }
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG" }).format(val)
  }

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleSaleChange = (saleId: string) => {
    setSelectedSaleId(saleId)
    const sale = sales.find((s) => s.id === saleId)
    if (sale?.customer) {
      setSelectedCustomerId(sale.customer.id)
    } else {
      setSelectedCustomerId("")
    }
  }

  // Filter sales that DO NOT already have an emitted internal control receipt
  const availableSales = sales.filter(
    (s) => !receipts.some((r) => r.saleId === s.id)
  )

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div>
          <h1 className={styles.title}>Comprobantes de Control Interno</h1>
          <p className={styles.subtitle}>
            Gestione y emita comprobantes administrativos de uso interno generados directamente en PDF por el servidor.
          </p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className={styles.emitButton}>
          <Plus size={18} />
          Emitir Comprobante
        </button>
      </div>

      {/* Filters Panel */}
      <div className={styles.filtersPanel}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Estado</label>
          <select
            value={voidedFilter}
            onChange={(e) => setVoidedFilter(e.target.value as any)}
            className={styles.filterSelect}
          >
            <option value="ALL">Todos los Estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="VOIDED">Anulados</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={styles.filterInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={styles.filterInput}
          />
        </div>

        <div className={styles.filterGroup} style={{ justifyContent: "flex-end" }}>
          <button onClick={fetchReceipts} className={styles.searchButton}>
            <Search size={16} />
            Buscar
          </button>
        </div>
      </div>

      {/* Receipts Table */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ padding: "5rem 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <RefreshCw className="animate-spin text-primary" size={32} style={{ color: "var(--primary)" }} />
            <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>Cargando comprobantes...</p>
          </div>
        ) : receipts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "5rem 0" }}>
            <FileText className="mx-auto" size={48} style={{ color: "var(--muted-foreground)", opacity: 0.4, margin: "0 auto 1rem" }} />
            <h3 style={{ fontWeight: 600, fontSize: "1.125rem" }}>No se encontraron comprobantes</h3>
            <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>Intente cambiar los filtros o emita un comprobante nuevo.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeaderRow}>
                  <th className={styles.th}>Nro. Comprobante</th>
                  <th className={styles.th}>Fecha Emisión</th>
                  <th className={styles.th}>Empresa</th>
                  <th className={styles.th}>Cliente</th>
                  <th className={styles.th}>Total</th>
                  <th className={styles.th}>Estado</th>
                  <th className={styles.th} style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => {
                  const comp = receipt.snapshot?.company
                  const cust = receipt.snapshot?.customer
                  return (
                    <tr key={receipt.id} className={styles.tr}>
                      <td className={styles.docNumberCol}>
                        CI-{String(receipt.docNumber).padStart(7, "0")}
                      </td>
                      <td className={styles.td}>{formatDate(receipt.createdAt)}</td>
                      <td className={styles.td}>{comp?.legalName || "N/A"}</td>
                      <td className={styles.td}>
                        {cust?.name || <span style={{ color: "var(--muted-foreground)", fontStyle: "italic" }}>Consumidor Final</span>}
                      </td>
                      <td className={styles.td} style={{ fontWeight: 600 }}>{formatCurrency(receipt.total)}</td>
                      <td className={styles.td}>
                        {receipt.voided ? (
                          <span className={styles.badgeVoided}>Anulado</span>
                        ) : (
                          <span className={styles.badgeActive}>Activo</span>
                        )}
                      </td>
                      <td className={styles.td} style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                          <button
                            onClick={() => handlePreviewPdf(receipt)}
                            title="Ver PDF / Imprimir"
                            style={{ padding: "0.5rem", borderRadius: "0.375rem", color: "var(--primary)", cursor: "pointer" }}
                          >
                            <Printer size={16} />
                          </button>
                          {!receipt.voided && (
                            <button
                              onClick={() => {
                                setVoidingId(receipt.id)
                                setIsVoidOpen(true)
                              }}
                              title="Anular Comprobante"
                              style={{ padding: "0.5rem", borderRadius: "0.375rem", color: "var(--destructive)", cursor: "pointer" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: CREATE INTERNAL RECEIPT */}
      {isCreateOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <FileText style={{ color: "var(--primary)" }} size={20} />
                Emitir Nuevo Comprobante
              </h2>
              <button onClick={() => setIsCreateOpen(false)} className={styles.modalClose}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} className={styles.form}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <Building2 size={15} style={{ color: "var(--muted-foreground)" }} />
                  Empresa Emisora
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className={styles.filterSelect}
                  required
                >
                  <option value="" disabled>Seleccionar Empresa...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.legalName}</option>
                  ))}
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <FileText size={15} style={{ color: "var(--muted-foreground)" }} />
                  Venta Asociada
                </label>
                <select
                  value={selectedSaleId}
                  onChange={(e) => handleSaleChange(e.target.value)}
                  className={styles.filterSelect}
                  required
                >
                  <option value="" disabled>Seleccionar Venta...</option>
                  {availableSales.length === 0 ? (
                    <option disabled>No hay ventas activas disponibles</option>
                  ) : (
                    availableSales.map((s) => (
                      <option key={s.id} value={s.id}>
                        Venta #{s.id.slice(0, 8)} - {formatDate(s.saleDate)} ({formatCurrency(s.total)})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedSaleId && (
                <div className={styles.customerDetectedPanel}>
                  <div className={styles.customerDetectedTitle}>Cliente Detectado</div>
                  <div className={styles.customerDetectedValue}>
                    <User size={14} style={{ color: "var(--primary)" }} />
                    {sales.find((s) => s.id === selectedSaleId)?.customer?.name || "Consumidor Final"}
                  </div>
                </div>
              )}

              <div className={styles.buttonGroup}>
                <button type="button" onClick={() => setIsCreateOpen(false)} className={styles.btnCancel}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className={styles.btnSubmit}>
                  {submitting ? "Emitiendo..." : "Emitir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VOID RECEIPT */}
      {isVoidOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ padding: "1.25rem", gap: "1rem" }}>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--destructive)", fontSize: "1.125rem", fontWeight: 700 }}>
              <AlertTriangle size={20} />
              Anular Comprobante
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
              ¿Estás seguro de que deseas anular el comprobante? Esto no afectará la venta registrada en el sistema.
            </p>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Motivo de Anulación</label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Ej. Error en los datos del cliente..."
                rows={3}
                className={styles.filterInput}
                style={{ fontFamily: "inherit", resize: "vertical" }}
              />
            </div>
            <div className={styles.buttonGroup}>
              <button
                type="button"
                onClick={() => {
                  setIsVoidOpen(false)
                  setVoidingId(null)
                  setVoidReason("")
                }}
                className={styles.btnCancel}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleVoidReceipt}
                className={styles.btnSubmit}
                style={{ backgroundColor: "var(--destructive)", color: "#fff" }}
              >
                Confirmar Anulación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PDF VIEW & IFRAME PREVIEW */}
      {previewReceipt && (
        <div className={styles.modalOverlay}>
          <div className={styles.pdfPreviewContent}>
            <div className={styles.pdfPreviewHeader}>
              <h2 className={styles.modalTitle}>
                <Printer size={18} style={{ color: "var(--primary)" }} />
                Comprobante CI-{String(previewReceipt.docNumber).padStart(7, "0")}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {pdfUrl && (
                  <>
                    <button
                      onClick={handlePrintPdf}
                      className={styles.pdfDownloadLink}
                      style={{ border: "none", background: "none", cursor: "pointer" }}
                    >
                      <Printer size={16} />
                      Imprimir
                    </button>
                    <a
                      href={pdfUrl}
                      download={`comprobante-interno-${previewReceipt.docNumber}.pdf`}
                      className={styles.pdfDownloadLink}
                    >
                      <Download size={16} />
                      Descargar PDF
                    </a>
                  </>
                )}
                <button
                  onClick={() => {
                    setPreviewReceipt(null)
                    setPdfUrl(null)
                  }}
                  className={styles.modalClose}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={styles.pdfIframeWrapper}>
              {loadingPdf ? (
                <div className={styles.pdfLoadingSpinner}>
                  <RefreshCw className="animate-spin" size={32} style={{ color: "var(--primary)" }} />
                  <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", fontWeight: 500 }}>
                    Generando PDF en el servidor...
                  </p>
                </div>
              ) : pdfUrl ? (
                <iframe
                  id="pdf-iframe"
                  src={`${pdfUrl}#toolbar=0&navpanes=0`}
                  className={styles.pdfIframe}
                />
              ) : (
                <div style={{ textAlign: "center", padding: "1.5rem" }}>
                  <AlertTriangle size={40} style={{ color: "var(--destructive)", margin: "0 auto 0.5rem" }} />
                  <p style={{ fontSize: "0.875rem", fontWeight: 500 }}>Error al cargar el archivo de comprobante.</p>
                </div>
              )}
            </div>

            <div className={styles.buttonGroup} style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => {
                  setPreviewReceipt(null)
                  setPdfUrl(null)
                }}
                className={styles.btnCancel}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
