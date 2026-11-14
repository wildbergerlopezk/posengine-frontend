"use client"

import { useCallback, useEffect, useState } from "react"
import { API_BASE_URL } from "@/src/shared/config/api"

export interface CommercialCapability {
  enabled: boolean
  reason: string | null
}

export interface CommercialCapabilities {
  purchaseReturns: CommercialCapability
  purchaseReturnSettlements: CommercialCapability
  supplierCreditApplications: CommercialCapability
  saleReturns: CommercialCapability
  saleReturnRefunds: CommercialCapability
  purchaseCancellations: CommercialCapability
  saleCancellations: CommercialCapability
  saleRestorations: CommercialCapability
}

interface State {
  capabilities: CommercialCapabilities | null
  loading: boolean
  error: string | null
}

const unavailableMessage = "No se pudo verificar la disponibilidad de las operaciones. Por seguridad, no se pueden confirmar cambios ahora."

export function useCommercialCapabilities(accessToken: string) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<State>({ capabilities: null, loading: true, error: null })

  useEffect(() => {
    const controller = new AbortController()
    if (!accessToken) {
      setState({ capabilities: null, loading: false, error: unavailableMessage })
      return () => controller.abort()
    }

    setState({ capabilities: null, loading: true, error: null })
    void fetch(`${API_BASE_URL}/commercial-operations/capabilities`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    }).then(async response => {
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.message || unavailableMessage)
      return body as CommercialCapabilities
    }).then(capabilities => {
      if (!controller.signal.aborted) setState({ capabilities, loading: false, error: null })
    }).catch(() => {
      if (!controller.signal.aborted) setState({ capabilities: null, loading: false, error: unavailableMessage })
    })

    return () => controller.abort()
  }, [accessToken, revision])

  const refresh = useCallback(() => setRevision(value => value + 1), [])
  return { ...state, refresh }
}
