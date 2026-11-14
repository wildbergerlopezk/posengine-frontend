import { apiClient } from '@/src/shared/api/apiClient'

export interface DashboardDataResponse {
  timezone: string
  returnTrackingAvailable: boolean
  billing: {
    today: number
    todayReturns: number
    netToday: number
    todaySalesCount: number
    creditBalanceToday: number
    month: number
    monthReturns: number
    netMonth: number
  }
  collections: {
    today: number
    cash: number
    card: number
    transfer: number
    electronic: number
    unclassified: number
  }
  cash: {
    status: 'OPEN' | 'CLOSED'
    expectedAmount: number | null
    reconciliationPending: boolean
  }
  receivables: {
    balance: number
    customersCount: number
  }
  stock: {
    lowStockCount: number
    outOfStockCount: number
    items: LowStockProduct[]
  }
  recentSales: RecentSale[]
}

export interface LowStockProduct {
  id: string
  name: string
  sku: string | null
  stock: number
  stockMinimum: number
  unitType: 'UNIT' | 'KG' | 'G' | 'L' | 'ML' | 'MG'
}

export interface RecentSale {
  id: string
  total: number
  saleDate: string
  customerName: string
  paymentType: 'CASH' | 'CREDIT'
  itemCount: number
}

const inFlightRequests = new Map<string, Promise<DashboardDataResponse>>()

export function getDashboardData(accessToken: string): Promise<DashboardDataResponse> {
  const currentRequest = inFlightRequests.get(accessToken)
  if (currentRequest) return currentRequest

  const request = apiClient.get<DashboardDataResponse>('/dashboard/stats', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  inFlightRequests.set(accessToken, request)
  void request.finally(() => {
    if (inFlightRequests.get(accessToken) === request) inFlightRequests.delete(accessToken)
  }).catch(() => undefined)
  return request
}
