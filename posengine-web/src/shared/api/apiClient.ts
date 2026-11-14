import { API_BASE_URL } from "@/src/shared/config/api"
import { useAuthStore } from "@/src/features/auth/store/auth.store"

interface RequestOptions extends RequestInit {
  skipAuth?: boolean
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

function toApiError(status: number, data: any): ApiError {
  const message = typeof data?.message === "string"
    ? data.message
    : "No se pudo completar la solicitud."

  return new ApiError(
    message,
    status,
    typeof data?.code === "string" ? data.code : `HTTP_${status}`,
    data?.details,
    typeof data?.requestId === "string" ? data.requestId : undefined,
  )
}

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

const processQueue = (token: string) => {
  refreshQueue.forEach((callback) => callback(token))
  refreshQueue = []
}

const rejectQueue = () => {
  refreshQueue = []
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, ...init } = options
  const url = `${API_BASE_URL}${path}`

  const headers = new Headers(init.headers)
  const isMultipartBody = typeof FormData !== "undefined" && init.body instanceof FormData
  if (!headers.has("Content-Type") && !isMultipartBody) {
    headers.set("Content-Type", "application/json")
  }

  // Marcar la petición para que el AuthInterceptor temporal no la vuelva a interceptar
  headers.set("X-Client-Request", "true")

  const { accessToken, refreshToken, setAuth, logout } = useAuthStore.getState()

  if (accessToken && !skipAuth) {
    headers.set("Authorization", `Bearer ${accessToken}`)
  }

  init.headers = headers

  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(
        "No pudimos conectar con el servidor. Intentá nuevamente.",
        0,
        "NETWORK_ERROR",
      )
    }
    throw error
  }

  if (response.status === 401 && !skipAuth) {
    if (!refreshToken) {
      logout()
      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }
      throw new Error("No refresh token available")
    }

    if (isRefreshing) {
      return new Promise<T>((resolve, reject) => {
        refreshQueue.push((newToken) => {
          const retryHeaders = new Headers(init.headers)
          retryHeaders.set("Authorization", `Bearer ${newToken}`)
          const retryInit = { ...init, headers: retryHeaders }
          fetch(url, retryInit)
            .then(async (res) => {
              const data = await res.json().catch(() => null)
              if (!res.ok) {
                reject(toApiError(res.status, data))
              } else {
                resolve(data)
              }
            })
            .catch(reject)
        })
      })
    }

    isRefreshing = true

    try {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Request": "true",
        },
        body: JSON.stringify({ refreshToken }),
      })

      if (refreshRes.ok) {
        const data = await refreshRes.json()
        const currentUser = useAuthStore.getState().user
        setAuth({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: currentUser!,
        })

        processQueue(data.accessToken)

        const retryHeaders = new Headers(init.headers)
        retryHeaders.set("Authorization", `Bearer ${data.accessToken}`)
        const retryInit = { ...init, headers: retryHeaders }
        
        const finalRes = await fetch(url, retryInit)
        const finalData = await finalRes.json().catch(() => null)
        if (!finalRes.ok) {
          throw toApiError(finalRes.status, finalData)
        }
        return finalData
      } else {
        logout()
        rejectQueue()
        if (typeof window !== "undefined") {
          window.location.href = "/login"
        }
        throw new Error("Session expired")
      }
    } catch (err) {
      logout()
      rejectQueue()
      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }
      throw err
    } finally {
      isRefreshing = false
    }
  }

  const contentType = response.headers.get("Content-Type") || ""
  if (!contentType.includes("application/json")) {
    if (!response.ok) {
      throw new ApiError("No se pudo completar la solicitud.", response.status, `HTTP_${response.status}`)
    }
    return response as unknown as T
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw toApiError(response.status, data)
  }

  return data
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
}

if (typeof window !== "undefined") {
  const originalFetch = window.fetch
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

    const isApiRequest = url.includes(API_BASE_URL)
    const isRefreshRequest = url.includes("/auth/refresh")
    const hasClientHeader =
      init?.headers &&
      ((init.headers instanceof Headers && init.headers.has("X-Client-Request")) ||
        (Array.isArray(init.headers) && init.headers.some(([k]) => k.toLowerCase() === "x-client-request")) ||
        (typeof init.headers === "object" && (init.headers as Record<string, string>)["X-Client-Request"]))

    if (!isApiRequest || isRefreshRequest || hasClientHeader) {
      return originalFetch(input, init)
    }

    const path = url.replace(API_BASE_URL, "")
    const method = init?.method || "GET"
    const requestOptions: RequestOptions = {
      ...init,
      method,
    }

    try {
      const data = await request<any>(path, requestOptions)
      if (data instanceof Response) {
        return data
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
      })
    } catch (error: unknown) {
      const apiError = error instanceof ApiError
        ? error
        : new ApiError(
          "Ocurrió un error inesperado. Intentá nuevamente más tarde.",
          500,
          "INTERNAL_ERROR",
        )
      const status = apiError.status || 503
      return new Response(
        JSON.stringify({
          success: false,
          statusCode: status,
          code: apiError.code,
          message: apiError.message,
          details: apiError.details,
          requestId: apiError.requestId,
        }),
        {
          status,
          headers: new Headers({ "Content-Type": "application/json" }),
        },
      )
    }
  }
}
