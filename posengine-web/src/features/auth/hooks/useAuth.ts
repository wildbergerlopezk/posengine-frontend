"use client"

import { useAuthStore } from "../store/auth.store"

export function useAuth() {
  const { user, tenant, isAuthenticated, logout } = useAuthStore()

  return {
    user,
    tenant,
    isAuthenticated,
    logout,
  }
}
