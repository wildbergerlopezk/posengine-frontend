import type { LoginCredentials, RegisterCredentials, OnboardingData } from "../types"
import type { User, Tenant } from "@/src/shared/types"

// Simulated API calls - replace with real API calls
export async function loginApi(credentials: LoginCredentials): Promise<{ user: User; tenant: Tenant }> {
  await new Promise((resolve) => setTimeout(resolve, 1000))

  return {
    user: {
      id: "u1",
      email: credentials.email,
      name: "Juan Pérez",
      role: "owner",
      tenantId: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    tenant: {
      id: "t1",
      name: "Mi Tienda",
      slug: "mi-tienda",
      currency: "ARS",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}

export async function registerApi(credentials: RegisterCredentials): Promise<User> {
  await new Promise((resolve) => setTimeout(resolve, 1000))

  return {
    id: "u-new",
    email: credentials.email,
    name: credentials.name,
    role: "owner",
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export async function createTenantApi(data: OnboardingData, user: User): Promise<Tenant> {
  await new Promise((resolve) => setTimeout(resolve, 1500))

  const slug = data.businessName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

  return {
    id: `t-${Date.now()}`,
    name: data.businessName,
    slug,
    address: data.address,
    phone: data.phone,
    currency: data.currency,
    email: user.email,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
