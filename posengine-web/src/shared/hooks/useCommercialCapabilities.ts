"use client"

import { useCallback, useEffect, useState } from "react"
import { API_BASE_URL } from "@/src/shared/config/api"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import {
  getOrLoadCommercialCapabilities,
  invalidateCommercialCapabilities,
} from "./commercialCapabilitiesCache.mjs"

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
  scopeKey: string | null
  capabilities: CommercialCapabilities | null
  loading: boolean
  error: string | null
}

const unavailableMessage = "No se pudo verificar la disponibilidad de las operaciones. Por seguridad, no se pueden confirmar cambios ahora."

export function useCommercialCapabilities(accessToken: string) {
  const user = useAuthStore(state => state.user)
  const sessionKey = user ? JSON.stringify([user.id, user.tenantId]) : null
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<State>({ scopeKey: null, capabilities: null, loading: true, error: null })

  useEffect(() => {
    let active = true
    if (!accessToken || !sessionKey) {
      setState({ scopeKey: sessionKey, capabilities: null, loading: false, error: unavailableMessage })
      return () => { active = false }
    }

    setState(previous => ({
      scopeKey: sessionKey,
      capabilities: previous.scopeKey === sessionKey ? previous.capabilities : null,
      loading: true,
      error: null,
    }))
    void getOrLoadCommercialCapabilities(sessionKey, async () => {
      const response = await fetch(`${API_BASE_URL}/commercial-operations/capabilities`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.message || unavailableMessage)
      return body as CommercialCapabilities
    }).then(capabilities => {
      if (active) setState({ scopeKey: sessionKey, capabilities, loading: false, error: null })
    }).catch(() => {
      if (active) setState({ scopeKey: sessionKey, capabilities: null, loading: false, error: unavailableMessage })
    })

    return () => { active = false }
  }, [accessToken, sessionKey, revision])

  const refresh = useCallback(() => {
    if (sessionKey) invalidateCommercialCapabilities(sessionKey)
    setRevision(value => value + 1)
  }, [sessionKey])
  const currentState = state.scopeKey === sessionKey
    ? state
    : { scopeKey: sessionKey, capabilities: null, loading: Boolean(accessToken && sessionKey), error: null }
  return { ...currentState, refresh }
}
