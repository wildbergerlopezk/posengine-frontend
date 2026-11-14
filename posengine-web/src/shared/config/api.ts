const envBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim()

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1"
}

function isPrivateLanAddress(hostname: string) {
  return isLoopback(hostname)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
}

function resolveApiBaseUrl() {
  if (typeof window !== "undefined" && isPrivateLanAddress(window.location.hostname)) {
    if (!envBackendUrl) {
      return `${window.location.protocol}//${window.location.hostname}:3005`
    }

    try {
      const configuredUrl = new URL(envBackendUrl, window.location.origin)
      if (isLoopback(configuredUrl.hostname)) {
        configuredUrl.hostname = window.location.hostname
      }
      return configuredUrl.toString().replace(/\/+$/, "")
    } catch {
      // Keep the configured value below so malformed deployment config remains visible.
    }
  }

  return (envBackendUrl || "/api").replace(/\/+$/, "")
}

// Local browser sessions use the same host for the web app and API. This keeps
// HttpOnly device cookies first-party on both localhost and LAN access.
export const API_BASE_URL = resolveApiBaseUrl()
