import { useState, useEffect, useCallback } from 'react'

export type CashSessionStatus = 'OPEN' | 'CLOSED'

export interface CashSession {
  id: string
  tenantId: string
  openedAt: string
  closedAt?: string
  openingAmount: number
  closingAmount?: number
  expectedAmount?: number
  expectedCashAmount?: number | null
  totalSales: number
  totalCreditSales?: number
  totalCashSales?: number
  totalPhysicalCashSales?: number
  totalElectronicSales?: number
  totalDebtPayments?: number
  totalCashDebtPayments?: number
  totalElectronicDebtPayments?: number
  unclassifiedCustomerPayments?: number
  totalPurchases: number
  totalCashPurchases?: number
  totalCreditPurchases?: number
  totalPurchaseDebtPayments?: number
  totalCashPurchaseDebtPayments?: number
  totalElectronicPurchaseDebtPayments?: number
  unclassifiedSupplierPayments?: number
  totalManualInflows?: number
  totalManualOutflows?: number
  cashReconciliationRequired?: boolean
  movements?: Array<{
    id: string
    amount: number
    type: 'IN' | 'OUT'
    description: string
    createdAt: string
  }>
  difference?: number
  status: CashSessionStatus
  openedBy: string
}

export interface CurrentSessionResponse {
  session: CashSession | null
}

export type ReconciliationMethod = 'CASH' | 'TRANSFER' | 'CARD'
export interface ReconciliationPayment {
  id: string
  type: 'CUSTOMER' | 'SUPPLIER'
  customer?: { id: string; name: string }
  supplier?: { id: string; name: string }
  date: string
  amount: number | string
  reference: string
  paymentMethod: string | null
  canClassify: boolean
  reason: string | null
}
export interface ReconciliationResponse {
  sessionId: string
  customers: ReconciliationPayment[]
  suppliers: ReconciliationPayment[]
}

import { useAuthStore } from '@/src/features/auth/store/auth.store'
import { API_BASE_URL } from '@/src/shared/config/api'

const API_BASE = `${API_BASE_URL}/cash-sessions`

async function apiFetch<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.message ?? 'Error desconocido')
  }
  return data as T
}

export function useCashSession() {
  const { accessToken } = useAuthStore()
  const [session, setSession] = useState<CashSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCurrent = useCallback(async (showLoading = true) => {
    if (!accessToken) return
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Sin conexión a internet")
      setLoading(false)
      return
    }
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<CurrentSessionResponse>(`${API_BASE}/current`, accessToken)
      setSession(data.session)
    } catch (err: any) {
      setError(err.message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [accessToken])

  const getReconciliationItems = useCallback(async () => {
    return apiFetch<ReconciliationResponse>(`${API_BASE}/current/reconciliation`, accessToken!)
  }, [accessToken])

  const classifyPayment = useCallback(
    async (type: 'CUSTOMER' | 'SUPPLIER', paymentId: string, paymentMethod: ReconciliationMethod, reason: string) => {
      const result = await apiFetch<{ id: string }>(
        `${API_BASE}/current/reconciliation/${type}/${paymentId}`,
        accessToken!,
        { method: 'PATCH', body: JSON.stringify({ paymentMethod, reason }) },
      )
      await fetchCurrent(false)
      return result
    },
    [accessToken, fetchCurrent],
  )

  useEffect(() => {
    fetchCurrent()
  }, [fetchCurrent])

  useEffect(() => {
    const handleFocus = () => fetchCurrent()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchCurrent])

  const openCash = useCallback(
    async (openingAmount: number, notes?: string) => {
      const result = await apiFetch<CashSession>(`${API_BASE}/open`, accessToken!, {
        method: 'POST',
        body: JSON.stringify({ openingAmount, notes }),
      })
      setSession(result)
      return result
    },
    [accessToken],
  )

  const closeCash = useCallback(
    async (sessionId: string, closingAmount: number, notes?: string) => {
      const result = await apiFetch<CashSession>(
        `${API_BASE}/${sessionId}/close`,
        accessToken!,
        {
          method: 'POST',
          body: JSON.stringify({ closingAmount, notes }),
        },
      )
      setSession(null)
      return result
    },
    [accessToken],
  )

  const addMovement = useCallback(
    async (amount: number, type: 'IN' | 'OUT', description: string) => {
      const result = await apiFetch<any>(
        `${API_BASE}/active/movements`,
        accessToken!,
        {
          method: 'POST',
          body: JSON.stringify({ amount, type, description }),
        },
      )
      await fetchCurrent()
      return result
    },
    [accessToken, fetchCurrent],
  )

  return {
    session,
    loading,
    error,
    refresh: fetchCurrent,
    openCash,
    closeCash,
    addMovement,
    getReconciliationItems,
    classifyPayment,
  }
}

