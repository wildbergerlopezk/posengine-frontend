const DEFAULT_DESKTOP_BACKEND_URL = "http://127.0.0.1:3005"

const envBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim()

export const API_BASE_URL = (envBackendUrl && envBackendUrl.length > 0
  ? envBackendUrl
  : DEFAULT_DESKTOP_BACKEND_URL
).replace(/\/+$/, "")
