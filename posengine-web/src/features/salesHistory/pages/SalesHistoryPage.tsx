"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/src/shared/components/Header"
import { AlertCircle, X, ChevronLeft, ChevronRight } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
import styles from "./SalesHistoryPage.module.css"
import { SalesFilterBar } from "../components/SalesFilterBar"
import { SalesHistoryTable } from "../components/SalesHistoryTable"
import { SaleDetailModal } from "../components/SaleDetailModal"

const API_BASE = API_BASE_URL

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

interface PaginatedResponse {
  items: Sale[]
  total: number
  page: number
  limit: number
}

export function SalesHistoryPage() {
  const { accessToken } = useAuthStore()
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  // ── List state ─────────────────────────────────────────────────────────────
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<SaleStatus | "ALL">("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const LIMIT = 10

  // ── Detail modal state ─────────────────────────────────────────────────────
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // ── Control Interno e Impresión ─────────────────────────────────────────────
  const [internalReceipt, setInternalReceipt] = useState<any | null>(null)
  const [checkingReceipt, setCheckingReceipt] = useState(false)
  const [companies, setCompanies] = useState<any[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("")
  const [emittingReceipt, setEmittingReceipt] = useState(false)
  const [printingReceipt, setPrintingReceipt] = useState(false)

  // ── Fetch list ─────────────────────────────────────────────────────────────
  const fetchSales = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (statusFilter !== "ALL") params.set("status", statusFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo)   params.set("dateTo", dateTo)

      const res = await fetch(`${API_BASE}/sales?${params}`, { headers: authHeaders })
      if (!res.ok) throw new Error("Error al cargar ventas")
      const data: PaginatedResponse = await res.json()
      setSales(data.items ?? [])
      setTotalItems(data.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, dateFrom, dateTo, accessToken])

  useEffect(() => { void fetchSales() }, [fetchSales])
  useEffect(() => { setPage(1) }, [statusFilter, dateFrom, dateTo, search])

  // ── Fetch companies for receipt emission ────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return
    const fetchCompanies = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/companies?limit=10`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (res.ok) {
          const data = await res.json()
          const items = data.items || data
          setCompanies(items)
          if (items.length > 0) {
            setSelectedCompanyId(items[0].id)
          }
        }
      } catch (err) {
        console.error("Error al cargar empresas:", err)
      }
    }
    void fetchCompanies()
  }, [accessToken])

  // ── Check if sale has internal receipt ──────────────────────────────────────
  useEffect(() => {
    if (!selectedSale || !accessToken) {
      setInternalReceipt(null)
      return
    }
    const checkReceipt = async () => {
      setCheckingReceipt(true)
      try {
        const res = await fetch(`${API_BASE_URL}/internal-receipts?saleId=${selectedSale.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.items && data.items.length > 0) {
            setInternalReceipt(data.items[0])
          } else {
            setInternalReceipt(null)
          }
        }
      } catch (e) {
        console.error("Error checking internal receipt", e)
      } finally {
        setCheckingReceipt(false)
      }
    }
    void checkReceipt()
  }, [selectedSale, accessToken])

  // ── Emit Internal Receipt ──────────────────────────────────────────────────
  const handleEmitReceipt = async () => {
    if (!selectedSale || !selectedCompanyId || !accessToken) return
    setEmittingReceipt(true)
    try {
      const res = await fetch(`${API_BASE_URL}/internal-receipts`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          saleId: selectedSale.id,
          customerId: selectedSale.customer?.id || undefined,
          companyId: selectedCompanyId,
        })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || "Error al emitir comprobante de control interno")
      }
      const data = await res.json()
      setInternalReceipt(data)
    } catch (e: any) {
      alert(e.message || "Error al generar control interno")
    } finally {
      setEmittingReceipt(false)
    }
  }

  // ── Print Receipt PDF ──────────────────────────────────────────────────────
  const handlePrintReceipt = async () => {
    if (!internalReceipt || !accessToken) return
    setPrintingReceipt(true)
    try {
      const res = await fetch(`${API_BASE_URL}/internal-receipts/${internalReceipt.id}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error("Error al descargar PDF del comprobante")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `comprobante-ci-${internalReceipt.docNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e.message || "Error al descargar PDF")
    } finally {
      setPrintingReceipt(false)
    }
  }

  // ── Open detail modal ──────────────────────────────────────────────────────
  const openDetail = async (sale: Sale) => {
    setSelectedSale({ ...sale, items: undefined })
    setLoadingDetail(true)
    setDetailError(null)
    setCancelError(null)
    try {
      const res = await fetch(`${API_BASE}/sales/${sale.id}`, { headers: authHeaders })
      if (!res.ok) throw new Error("Error al cargar el detalle")
      const data: Sale = await res.json()
      setSelectedSale(data)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Error al cargar detalle")
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeDetail = () => {
    setSelectedSale(null)
    setDetailError(null)
    setCancelError(null)
    setInternalReceipt(null)
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!selectedSale) return
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await fetch(`${API_BASE}/sales/${selectedSale.id}/cancel`, {
        method: "PATCH",
        headers: authHeaders,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Error al anular la venta")
      }
      await fetchSales()
      closeDetail()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setCancelling(false)
    }
  }

  const handleRestore = async () => {
    if (!selectedSale) return
    setRestoring(true)
    setCancelError(null)
    try {
      const res = await fetch(`${API_BASE}/sales/${selectedSale.id}/uncancel`, {
        method: "PATCH",
        headers: authHeaders,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Error al desanular la venta")
      }
      await fetchSales()
      closeDetail()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setRestoring(false)
    }
  }

  const filteredSales = search.trim()
    ? sales.filter(s => 
        s.id.toLowerCase().includes(search.toLowerCase()) ||
        s.customer?.name.toLowerCase().includes(search.toLowerCase())
      )
    : sales

  const totalPages = Math.ceil(totalItems / LIMIT)
  const hasActiveFilters = !!(statusFilter !== "ALL" || dateFrom || dateTo)

  const clearFilters = () => {
    setStatusFilter("ALL")
    setDateFrom("")
    setDateTo("")
  }

  return (
    <div className={styles.page}>
      <Header title="Historial de ventas" />

      <div className={styles.container}>
        {error && (
          <div className={tableStyles.errorBanner}>
            <AlertCircle size={16} />
            {error}
            <button type="button" className={styles.bannerClose} onClick={() => setError(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        <SalesFilterBar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <SalesHistoryTable
          sales={filteredSales}
          loading={loading}
          error={error}
          totalItems={totalItems}
          onOpenDetail={openDetail}
        />

        {/* ── Paginación ── */}
        {!loading && totalPages > 1 && (
          <div className={styles.paginationCard}>
            <div className={styles.paginationInfo}>
              Mostrando página <strong>{page}</strong> de <strong>{totalPages}</strong> ({totalItems} ventas en total)
            </div>
            <div className={styles.paginationControls}>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc: (number | string)[], p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...")
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`dots-${i}`} className={styles.pageDots}>…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ""}`}
                      onClick={() => setPage(p as number)}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {selectedSale && (
        <SaleDetailModal
          selectedSale={selectedSale}
          onClose={closeDetail}
          loadingDetail={loadingDetail}
          detailError={detailError}
          cancelError={cancelError}
          cancelling={cancelling}
          restoring={restoring}
          onCancel={handleCancel}
          onRestore={handleRestore}
          internalReceipt={internalReceipt}
          checkingReceipt={checkingReceipt}
          companies={companies}
          selectedCompanyId={selectedCompanyId}
          emittingReceipt={emittingReceipt}
          printingReceipt={printingReceipt}
          onEmitReceipt={handleEmitReceipt}
          onPrintReceipt={handlePrintReceipt}
        />
      )}
    </div>
  )
}
