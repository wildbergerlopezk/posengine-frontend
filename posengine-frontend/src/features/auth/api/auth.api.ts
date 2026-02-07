import type { LoginCredentials, RegisterCredentials } from "../types"
import type { User } from "@/src/shared/types/user/userType";
import type { Tenant } from "@/src/shared/types/tenant/tenantType";
import type { RegisterUserDto } from "@/src/shared/types/user/userType.dto";
import type { RegisterTenantDto } from "@/src/shared/types/tenant/tenantType.dto";
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL

export async function loginApi(credentials: LoginCredentials): Promise<{ user: User; tenant: Tenant }> {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  //async de ejemplo
  return {
    user: {
      id: "u1",
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

export async function registerUserApi(data: RegisterUserDto): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/v1/accounts/register-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data), 
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.errorText || "Error al registrar usuario");
  }

  return res.json(); 
}

export async function createTenantApi(data: RegisterTenantDto): Promise<Tenant> {
  const res = await fetch(`${BASE_URL}/api/v1/tenant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data), 
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.errorText || "Error al crear el negocio");
  }

  return res.json();
}