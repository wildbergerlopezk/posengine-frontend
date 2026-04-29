import { useState, useCallback } from "react" 
import { useAuthStore } from "@/src/features/auth/store/auth.store" 
 
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL 
 
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
  const [open, setOpen] = useState(false) 
 
  const openFor = useCallback(async (productId: string, name: string) => { 
    setProductName(name) 
    setHistory([])   // ← limpiar antes de abrir, no después de cerrar 
    setOpen(true) 
    setLoading(true) 
    
    let cancelled = false  // ← flag local para esta invocación 
    
    try { 
      const res = await fetch(`${API_BASE}/product/${productId}/price-history`, { 
        headers: { Authorization: `Bearer ${accessToken}` }, 
      }) 
      if (res.ok && !cancelled) setHistory(await res.json()) 
    } catch { /* silent */ } 
    finally { if (!cancelled) setLoading(false) } 

    return () => { cancelled = true }  // cleanup si se llama de nuevo antes de terminar 
  }, [accessToken]) 
 
  const close = useCallback(() => { 
    setOpen(false) 
    setHistory([]) 
  }, []) 
 
  return { open, loading, history, productName, openFor, close } 
} 
