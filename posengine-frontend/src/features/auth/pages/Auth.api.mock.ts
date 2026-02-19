/**
 * 🧪 MOCK de auth.api.ts — Solo para probar el diseño sin backend
 * Reemplaza temporalmente el import en OnboardingPage.tsx:
 *
 *   import { createTenantApi, sendVerificationCodeApi, verifyCodeApi } from "../api/auth.api.mock"
 *
 * Cuando termines, vuelve a apuntar a "../api/auth.api"
 */

import type { User } from "@/src/shared/types/user/userType"
import type { Tenant } from "@/src/shared/types/tenant/tenantType"
import type { RegisterUserDto } from "@/src/shared/types/user/userType.dto"
import type { RegisterTenantDto } from "@/src/shared/types/tenant/tenantType.dto"

// ── Simula delay de red ────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ── Código válido fijo para probar ────────────────────────────────────────────
const MOCK_VALID_CODE = "123456"

// ── Registro de usuario ────────────────────────────────────────────────────────
export async function registerUserApi(data: RegisterUserDto): Promise<User> {
  await delay(800)
  console.log("🧪 [MOCK] registerUserApi →", data)
  return {
    id: "mock-user-id",
    email: data.email,
    fullName: data.fullName ?? "Usuario Mock",
    tenantId: 0,
  }
}

// ── Crear tenant ───────────────────────────────────────────────────────────────
export async function createTenantApi(userId: string, data: RegisterTenantDto): Promise<Tenant> {
  await delay(1000)
  console.log("🧪 [MOCK] createTenantApi →", { userId, data })
  return {
    id: 1,
    name: data.name,
  }
}

// ── Enviar código de verificación ─────────────────────────────────────────────
export async function sendVerificationCodeApi(email: string): Promise<void> {
  await delay(1200)
  console.log(`🧪 [MOCK] sendVerificationCodeApi → email: ${email}`)
  console.log(`🧪 [MOCK] Código válido para probar: ${MOCK_VALID_CODE}`)

  // Para simular un error de red, descomenta esto:
  // throw new Error("No se pudo enviar el código (simulado)")
}

// ── Verificar código ───────────────────────────────────────────────────────────
export async function verifyCodeApi(email: string, code: string): Promise<void> {
  await delay(900)
  console.log(`🧪 [MOCK] verifyCodeApi → email: ${email}, code: ${code}`)

  if (code !== MOCK_VALID_CODE) {
    throw new Error(`Código inválido. Usa "${MOCK_VALID_CODE}" para probar.`)
  }
}

// ── Login ──────────────────────────────────────────────────────────────────────
export async function loginApi(credentials: { email: string; password: string }) {
  await delay(800)
  return {
    user: {
      id: "mock-user-id",
      email: credentials.email,
      fullName: "Juan Pérez",
      tenantId: 1,
    },
    tenant: {
      id: 1,
      name: "Mi Tienda",
    },
  }
}