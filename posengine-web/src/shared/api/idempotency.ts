export class IdempotencyIntentMismatchError extends Error {
  constructor() {
    super("Hay una operación anterior sin resultado confirmado. Reintentá exactamente los mismos datos antes de modificarlos.")
    this.name = "IdempotencyIntentMismatchError"
  }
}

type StoredIntent = { key: string; requestHash: string }
const memoryFallback = new Map<string, StoredIntent>()

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString()
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    )
  }
  return value
}

async function requestHash(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(payload)))
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function intentStorageKey(operation: string, userId: string, tenantId: string): string {
  return `posengine-idempotency:${encodeURIComponent(operation)}:${encodeURIComponent(tenantId)}:${encodeURIComponent(userId)}`
}

function readIntent(storageKey: string): StoredIntent | null {
  try {
    const raw = typeof window === "undefined" ? null : window.sessionStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) as StoredIntent : memoryFallback.get(storageKey) ?? null
    return parsed && typeof parsed.key === "string" && typeof parsed.requestHash === "string" ? parsed : null
  } catch {
    return memoryFallback.get(storageKey) ?? null
  }
}

function storeIntent(storageKey: string, intent: StoredIntent): void {
  memoryFallback.set(storageKey, intent)
  try {
    if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey, JSON.stringify(intent))
  } catch {
    // The in-memory copy keeps same-page retry behavior when sessionStorage is unavailable.
  }
}

export async function prepareIdempotencyKey(
  operation: string,
  userId: string,
  tenantId: string | null | undefined,
  payload: unknown,
): Promise<string> {
  if (!userId || !tenantId) throw new Error("No se pudo determinar el usuario y negocio de esta operación.")
  const storageKey = intentStorageKey(operation, userId, tenantId)
  const fingerprint = await requestHash(payload)
  const existing = readIntent(storageKey)
  if (existing) {
    if (existing.requestHash !== fingerprint) throw new IdempotencyIntentMismatchError()
    return existing.key
  }

  const key = globalThis.crypto.randomUUID()
  storeIntent(storageKey, { key, requestHash: fingerprint })
  return key
}

export function getOrCreateIdempotencyTimestamp(
  operation: string,
  userId: string,
  tenantId: string | null | undefined,
  candidate: string,
): string {
  if (!userId || !tenantId) return candidate
  const storageKey = `${intentStorageKey(operation, userId, tenantId)}:timestamp`
  try {
    const existing = typeof window === "undefined" ? null : window.sessionStorage.getItem(storageKey)
    if (existing && Number.isFinite(new Date(existing).getTime())) return existing
    if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey, candidate)
  } catch {
    return candidate
  }
  return candidate
}

export function clearIdempotencyKey(operation: string, userId: string, tenantId: string | null | undefined): void {
  if (!userId || !tenantId) return
  const storageKey = intentStorageKey(operation, userId, tenantId)
  memoryFallback.delete(storageKey)
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(storageKey)
      window.sessionStorage.removeItem(`${storageKey}:timestamp`)
    }
  } catch {
    // The memory fallback is already cleared.
  }
}
