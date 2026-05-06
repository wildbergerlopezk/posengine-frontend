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
  totalPurchases: number
  difference?: number
  status: CashSessionStatus
  forcedClose: boolean
  openedBy: string
}

export interface CurrentSessionResponse {
  session: CashSession | null
  closedToday: boolean
  autoClosedStale?: boolean  // ← nuevo
}

import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"

const API_BASE = `${API_BASE_URL}/cash-sessions`
const POLL_INTERVAL_MS = 60_000

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
  const [state, setState] = useState<CurrentSessionResponse>({
    session: null,
    closedToday: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCurrent = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<CurrentSessionResponse>(`${API_BASE}/current`, accessToken)
      // Notificar al usuario si se cerró una sesión vieja automáticamente
      if (data.autoClosedStale) {
        console.info('[CashSession] Se cerró automáticamente una sesión pendiente del día anterior.')
        // Si tenés un sistema de toasts: toast.info('Se cerró la sesión pendiente del día anterior.')
      }
      setState(data)
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
    if (!accessToken) return
    const interval = setInterval(() => {
      fetchCurrent()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [accessToken, fetchCurrent])

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
      setState({ session: result, closedToday: false })
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
      setState({ session: null, closedToday: true })
      return result
    },
    [accessToken],
  )

  const forceCloseCash = useCallback(
    async (
      sessionId: string,
      closingAmount: number,
      confirmation: string,
      forceReason?: string,
    ) => {
      const result = await apiFetch<CashSession>(
        `${API_BASE}/${sessionId}/force-close`,
        accessToken!,
        {
          method: 'POST',
          body: JSON.stringify({ closingAmount, confirmation, forceReason }),
        },
      )
      setState({ session: null, closedToday: true })
      return result
    },
    [accessToken],
  )


  return {
    session: state.session,
    closedToday: state.closedToday,
    loading,
    error,
    refresh: fetchCurrent,
    openCash,
    closeCash,
    forceCloseCash,
  }
}
