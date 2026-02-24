"use client"

import { create } from "zustand"
import type { Tenant } from "@/src/shared/types/tenant/tenantType"
import type { User } from "@/src/shared/types/user/userType"

interface AuthState {
  user: User | null
  tenant: Tenant | null
  token: string | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setTenant: (tenant: Tenant | null) => void
  setToken: (token: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  token: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setTenant: (tenant) => set({ tenant }),
  setToken: (token) => set({ token }),
  logout: () => set({ user: null, tenant: null, token: null, isAuthenticated: false }),
}))