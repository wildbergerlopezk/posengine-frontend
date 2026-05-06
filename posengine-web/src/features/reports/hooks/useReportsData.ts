import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/src/features/auth/store/auth.store'
import { API_BASE_URL } from '@/src/shared/config/api'

const API_BASE = API_BASE_URL

interface ChartDataPoint {
  [key: string]: string | number
}

interface ReportsData {
  daily: ChartDataPoint[]
  weekly: ChartDataPoint[]
  monthly: ChartDataPoint[]
  yearly: ChartDataPoint[]
  loading: boolean
  error: string | null
}

interface Sale {
  id: string
  total: number
  status: string
  createdAt: string
  items?: Array<{
    productId: string
    quantity: number
    unitPrice: number
    total: number
  }>
}

interface PaginatedResponse {
  items: Sale[]
  total: number
  page: number
  limit: number
}

export function useReportsData() {
  const { accessToken } = useAuthStore()
  const [data, setData] = useState<ReportsData>({
    daily: [],
    weekly: [],
    monthly: [],
    yearly: [],
    loading: true,
    error: null,
  })

  const aggregateByPeriod = useCallback(
    (
      sales: Sale[],
      period: 'day' | 'week' | 'month' | 'year',
    ): ChartDataPoint[] => {
      if (sales.length === 0) return []

      const grouped: Record<string, { ventas: number; ganancias: number }> = {}

      sales.forEach((sale) => {
        const date = new Date(sale.createdAt)
        let key = ''

        if (period === 'day') {
          const hours = String(date.getHours()).padStart(2, '0')
          key = `${hours}:00`
        } else if (period === 'week') {
          const days = [
            'Dom',
            'Lun',
            'Mar',
            'Mié',
            'Jue',
            'Vie',
            'Sáb',
          ]
          key = days[date.getDay()]
        } else if (period === 'month') {
          const week = Math.ceil(date.getDate() / 7)
          key = `Sem ${week}`
        } else if (period === 'year') {
          const months = [
            'Ene',
            'Feb',
            'Mar',
            'Abr',
            'May',
            'Jun',
            'Jul',
            'Ago',
            'Sep',
            'Oct',
            'Nov',
            'Dic',
          ]
          key = months[date.getMonth()]
        }

        if (!grouped[key]) {
          grouped[key] = { ventas: 0, ganancias: 0 }
        }

        grouped[key].ventas += sale.total
        // Estimate margin as 30% (this would need real cost data)
        grouped[key].ganancias += sale.total * 0.3
      })

      return Object.entries(grouped).map(([key, value]) => ({
        [period === 'day'
          ? 'hour'
          : period === 'week'
            ? 'day'
            : period === 'month'
              ? 'week'
              : 'month']: key,
        ventas: Math.round(value.ventas),
        ganancias: Math.round(value.ganancias),
      }))
    },
    [],
  )

  useEffect(() => {
    if (!accessToken) return

    setData((prev) => ({ ...prev, loading: true, error: null }))

    const fetchReportsData = async () => {
      try {
        const authHeaders = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        }

        const today = new Date()
        const startOfDay = new Date(today)
        startOfDay.setHours(0, 0, 0, 0)
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay())
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const startOfYear = new Date(today.getFullYear(), 0, 1)

        const formatDate = (d: Date) => d.toISOString().split('T')[0]

        // Fetch all data in parallel
        const [dailyRes, weeklyRes, monthlyRes, yearlyRes] = await Promise.all([
          fetch(
            `${API_BASE}/sales?dateFrom=${formatDate(startOfDay)}&status=COMPLETED&limit=100`,
            { headers: authHeaders },
          ),
          fetch(
            `${API_BASE}/sales?dateFrom=${formatDate(startOfWeek)}&status=COMPLETED&limit=100`,
            { headers: authHeaders },
          ),
          fetch(
            `${API_BASE}/sales?dateFrom=${formatDate(startOfMonth)}&status=COMPLETED&limit=100`,
            { headers: authHeaders },
          ),
          fetch(
            `${API_BASE}/sales?dateFrom=${formatDate(startOfYear)}&status=COMPLETED&limit=100`,
            { headers: authHeaders },
          ),
        ])

        const [dailyData, weeklyData, monthlyData, yearlyData] = await Promise.all([
          dailyRes.json() as Promise<PaginatedResponse>,
          weeklyRes.json() as Promise<PaginatedResponse>,
          monthlyRes.json() as Promise<PaginatedResponse>,
          yearlyRes.json() as Promise<PaginatedResponse>,
        ])

        if (dailyRes.ok && weeklyRes.ok && monthlyRes.ok && yearlyRes.ok) {
          const aggregatedDaily = aggregateByPeriod(dailyData.items || [], 'day')
          const aggregatedWeekly = aggregateByPeriod(weeklyData.items || [], 'week')
          const aggregatedMonthly = aggregateByPeriod(monthlyData.items || [], 'month')
          const aggregatedYearly = aggregateByPeriod(yearlyData.items || [], 'year')

          setData({
            daily: aggregatedDaily.length > 0 ? aggregatedDaily : [],
            weekly: aggregatedWeekly.length > 0 ? aggregatedWeekly : [],
            monthly: aggregatedMonthly.length > 0 ? aggregatedMonthly : [],
            yearly: aggregatedYearly.length > 0 ? aggregatedYearly : [],
            loading: false,
            error: null,
          })
        } else {
          throw new Error('Error al cargar datos de reportes')
        }
      } catch (err: unknown) {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Error desconocido',
        }))
      }
    }

    void fetchReportsData()
  }, [accessToken, aggregateByPeriod])

  return data
}
