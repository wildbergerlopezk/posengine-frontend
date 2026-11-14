import { apiClient } from '@/src/shared/api/apiClient'
import type { AuthResponse } from '../types/auth.types'

function unwrap<T>(value: T | { data: T }): T {
  return value && typeof value === 'object' && 'data' in value ? value.data : value as T
}

export const quickPinApi = {
  async status() {
    return unwrap(await apiClient.get<{ enabled: boolean; deviceAuthorized: boolean; deviceAuthorizationDays: number }>('/auth/quick-pin/status', { credentials: 'include' }))
  },
  async deviceStatus() {
    return unwrap(await apiClient.get<{ enabled: boolean; userName?: string }>('/auth/quick-pin/device', { skipAuth: true, credentials: 'include' }))
  },
  async setup(password: string, pin: string, confirmPin: string) {
    return unwrap(await apiClient.post<{ enabled: boolean }>('/auth/quick-pin/setup', { password, pin, confirmPin }, { credentials: 'include' }))
  },
  async disable(password: string) {
    return unwrap(await apiClient.delete<{ enabled: boolean }>('/auth/quick-pin', { credentials: 'include', body: JSON.stringify({ password }) }))
  },
  async revokeDevice() {
    return unwrap(await apiClient.delete<{ revoked: boolean }>('/auth/quick-pin/device', { credentials: 'include' }))
  },
  async login(pin: string) {
    return unwrap(await apiClient.post<AuthResponse>('/auth/quick-pin/login', { pin }, { skipAuth: true, credentials: 'include' }))
  },
}
