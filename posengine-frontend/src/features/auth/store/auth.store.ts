"use client"

import { create } from "zustand"
import type { Tenant } from "@/src/shared/types/tenant/tenantType"
import type { User } from "@/src/shared/types/user/userType"

interface AuthState {
  user: User | null
  tenant: Tenant | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setTenant: (tenant: Tenant | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setTenant: (tenant) => set({ tenant }),
  logout: () => set({ user: null, tenant: null, isAuthenticated: false }),
}))
