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
  totalSales: number
  totalCreditSales?: number
  totalCashSales?: number
  totalDebtPayments?: number
  totalPurchases: number
  totalCashPurchases?: number
  totalCreditPurchases?: number
  totalPurchaseDebtPayments?: number
  difference?: number
  status: CashSessionStatus
  openedBy: string
}

export interface CurrentSessionResponse {
  session: CashSession | null
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

  const fetchCurrent = useCallback(async () => {
    if (!accessToken) return
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Sin conexión a internet")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<CurrentSessionResponse>(`${API_BASE}/current`, accessToken)
      setSession(data.session)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

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

  return {
    session,
    loading,
    error,
    refresh: fetchCurrent,
    openCash,
    closeCash,
  }
}
