import { useState, useCallback } from 'react'
import { useAuthStore } from '@/src/features/auth/store/auth.store'
import type { CashSession } from './useCashSession'

const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL}/cash-sessions`

export function useCashHistory() {
  const { accessToken } = useAuthStore()
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(
    async (year: number, month: number) => {
      if (!accessToken) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `${API_BASE}/history?year=${year}&month=${month}`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data?.message ?? 'Error al cargar historial')
        setSessions(data)
      } catch (err: any) {
        setError(err.message)
        setSessions([])
      } finally {
        setLoading(false)
      }
    },
    [accessToken],
  )

  return { sessions, loading, error, fetchHistory }
}
