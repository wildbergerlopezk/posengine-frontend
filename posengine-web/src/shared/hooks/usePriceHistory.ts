import { useState, useCallback } from "react" 
import { useAuthStore } from "@/src/features/auth/store/auth.store" 
import { API_BASE_URL } from "@/src/shared/config/api"
 
const API_BASE = API_BASE_URL 
 
export interface PriceHistoryEntry { 
  date: string 
  invoiceNumber: string 
  supplier: { id: string; name: string } 
  quantity: number 
  unitCost: number 
} 
 
export function usePriceHistory() {
  const { accessToken } = useAuthStore()
  const [history, setHistory] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [productName, setProductName] = useState("")
  const [productId, setProductId] = useState("")
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const LIMIT = 10

  const fetchHistory = useCallback(async (pid: string, p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/product/${pid}/price-history?page=${p}&limit=${LIMIT}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setHistory(data.items || [])
        setTotalItems(data.total || 0)
        setPage(data.page || p)
      }
    } catch { /* silent */ }
    finally { setLoading(true); setLoading(false) }
  }, [accessToken])

  const openFor = useCallback(async (pid: string, name: string) => {
    setProductName(name)
    setProductId(pid)
    setHistory([])
    setTotalItems(0)
    setPage(1)
    setOpen(true)
    void fetchHistory(pid, 1)
  }, [fetchHistory])

  const goToPage = useCallback((newPage: number) => {
    if (newPage < 1) return
    void fetchHistory(productId, newPage)
  }, [productId, fetchHistory])

  const close = useCallback(() => {
    setOpen(false)
    setHistory([])
    setProductId("")
  }, [])

  return { open, loading, history, productName, page, totalItems, limit: LIMIT, openFor, goToPage, close }
}
