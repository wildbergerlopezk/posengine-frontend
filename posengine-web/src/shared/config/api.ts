const envBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim()

export const API_BASE_URL = (envBackendUrl && envBackendUrl.length > 0
  ? envBackendUrl
  : "/api"  // fallback relativo para cuando no hay env configurado
).replace(/\/+$/, "")