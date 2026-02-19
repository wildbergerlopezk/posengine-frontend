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

export async function createTenantApi(userId: string, data: RegisterTenantDto): Promise<Tenant> {
  console.log("📝 [createTenantApi] Iniciando creación de tenant...");
  console.log("📝 [createTenantApi] userId:", userId);
  console.log("📝 [createTenantApi] data:", data);

  const res = await fetch(`${BASE_URL}/api/v1/tenant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data), 
  });

  console.log("📝 [createTenantApi] Response status:", res.status);

  if (!res.ok) {
    const error = await res.json();
    console.error("❌ [createTenantApi] Error al crear tenant:", error);
    throw new Error(error?.errorText || "Error al crear el negocio");
  }

  const tenant = await res.json();
  console.log("✅ [createTenantApi] Tenant creado exitosamente:", tenant);

  // Actualizar el tenantId del usuario automáticamente
  console.log("🔄 [createTenantApi] Actualizando tenantId del usuario...");
  try {
    const updatedUser = await updateUserTenantApi(userId, tenant.id);
    console.log("✅ [createTenantApi] Usuario actualizado exitosamente:", updatedUser);
  } catch (error) {
    console.error("❌ [createTenantApi] Error al actualizar tenant del usuario:", error);
    // No lanzamos el error para no interrumpir el flujo
    // El tenant ya fue creado exitosamente
  }

  console.log("🎉 [createTenantApi] Proceso completado, retornando tenant");
  return tenant;
}

export async function updateUserTenantApi(userId: string, tenantId: number): Promise<User> {
  console.log("🔄 [updateUserTenantApi] Iniciando actualización de usuario...");
  console.log("🔄 [updateUserTenantApi] userId:", userId);
  console.log("🔄 [updateUserTenantApi] tenantId:", tenantId);
  console.log("🔄 [updateUserTenantApi] URL:", `${BASE_URL}/api/v1/accounts/user-tenant`);
  
  const payload = { 
    userId: userId,
    tenantId: tenantId 
  };
  console.log("🔄 [updateUserTenantApi] Payload:", JSON.stringify(payload, null, 2));

  const res = await fetch(`${BASE_URL}/api/v1/accounts/user-tenant`, {
    method: "PUT", // <-- Cambiado de PATCH a PUT
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), 
  });

  console.log("🔄 [updateUserTenantApi] Response status:", res.status);

  if (!res.ok) {
    const error = await res.json();
    console.error("❌ [updateUserTenantApi] Error response:", error);
    throw new Error(error?.errorText || "Error al actualizar tenant del usuario");
  }

  const updatedUser = await res.json();
  console.log("✅ [updateUserTenantApi] Usuario actualizado:", updatedUser);
  
  return updatedUser;
}

export async function sendVerificationCodeApi(email: string): Promise<void> {
  const response = await fetch("/api/auth/send-verification-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message ?? "Error al enviar el código de verificación")
  }
}

/**
 * Verifica el código OTP de 6 dígitos introducido por el usuario.
 * Lanza un error si el código es incorrecto o ha expirado.
 */
export async function verifyCodeApi(email: string, code: string): Promise<void> {
  const response = await fetch("/api/auth/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message ?? "Código inválido o expirado")
  }
}
