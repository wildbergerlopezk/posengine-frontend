import assert from "node:assert/strict"
import test from "node:test"
import {
  getLoginErrorMessage,
  validateLoginCredentials,
} from "../src/features/auth/utils/auth.utils.ts"
import { createRefreshCoordinator } from "../src/features/auth/utils/refresh-coordinator.ts"
import {
  clearIdempotencyKey,
  IdempotencyIntentMismatchError,
  prepareIdempotencyKey,
} from "../src/shared/api/idempotency.ts"

test("login validation requires an email, valid email format, and password", () => {
  assert.equal(validateLoginCredentials("  ", "secret"), "Ingresá tu correo electrónico.")
  assert.equal(validateLoginCredentials("invalid-email", "secret"), "Ingresá un correo electrónico válido.")
  assert.equal(validateLoginCredentials("user@example.com", ""), "Ingresá tu contraseña.")
  assert.equal(validateLoginCredentials(" user@example.com ", "  "), null)
})

test("login maps authentication errors to a generic message", () => {
  assert.equal(getLoginErrorMessage({ status: 401, message: "user not found" }), "Correo o contraseña incorrectos.")
  assert.equal(getLoginErrorMessage({ status: 401, message: "password mismatch" }), "Correo o contraseña incorrectos.")
})

test("login distinguishes connectivity, authorization, rate limit, and server errors", () => {
  assert.equal(getLoginErrorMessage({ code: "NETWORK_ERROR", status: 0 }), "No pudimos conectar con el servidor. Intentá nuevamente.")
  assert.equal(getLoginErrorMessage({ status: 403 }), "No tenés permisos para iniciar sesión.")
  assert.equal(getLoginErrorMessage({ status: 429 }), "Demasiados intentos. Esperá un momento e intentá nuevamente.")
  assert.equal(getLoginErrorMessage({ status: 500 }), "Ocurrió un error inesperado. Intentá nuevamente más tarde.")
  assert.equal(getLoginErrorMessage({ status: 503 }), "No pudimos conectar con el servidor. Intentá nuevamente.")
})

test("login does not expose arbitrary server error messages", () => {
  assert.equal(
    getLoginErrorMessage({ status: 500, message: "postgres://user:secret@db/password" }),
    "Ocurrió un error inesperado. Intentá nuevamente más tarde.",
  )
})

test("unexpected client errors are not mislabeled as connectivity failures", () => {
  assert.equal(
    getLoginErrorMessage(new TypeError("Failed to serialize request")),
    "Ocurrió un error inesperado. Intentá nuevamente más tarde.",
  )
})

test("concurrent requests share one refresh and update the active session once", async () => {
  let resolveRefresh
  let calls = 0
  let snapshot = { isAuthenticated: true, refreshToken: "refresh-a", user: { id: "user-1" } }
  const refreshed = new Promise((resolve) => { resolveRefresh = resolve })
  let savedCredentials = null
  const coordinate = createRefreshCoordinator({
    getAuth: () => snapshot,
    refresh: async () => { calls += 1; return refreshed },
    setAuth: (credentials, user) => {
      savedCredentials = { ...credentials, user }
      snapshot = { ...snapshot, refreshToken: credentials.refreshToken }
    },
    onFailure: () => assert.fail("successful refresh must not log out"),
  })

  const first = coordinate("refresh-a")
  const second = coordinate("refresh-a")
  assert.equal(calls, 1)
  resolveRefresh({ accessToken: "access-b", refreshToken: "refresh-b" })
  assert.deepEqual(await Promise.all([first, second]), ["access-b", "access-b"])
  assert.deepEqual(savedCredentials, {
    accessToken: "access-b",
    refreshToken: "refresh-b",
    user: { id: "user-1" },
  })
})

test("a late refresh response cannot restore authentication after logout", async () => {
  let resolveRefresh
  let setAuthCalls = 0
  let failureCalls = 0
  let snapshot = { isAuthenticated: true, refreshToken: "refresh-a", user: { id: "user-1" } }
  const response = new Promise((resolve) => { resolveRefresh = resolve })
  const coordinate = createRefreshCoordinator({
    getAuth: () => snapshot,
    refresh: async () => response,
    setAuth: () => { setAuthCalls += 1 },
    onFailure: () => { failureCalls += 1 },
  })

  const pending = coordinate("refresh-a")
  snapshot = { isAuthenticated: false, refreshToken: null, user: null }
  resolveRefresh({ accessToken: "stale-access", refreshToken: "stale-refresh" })
  await assert.rejects(pending, /Session ended/)
  assert.equal(setAuthCalls, 0)
  assert.equal(failureCalls, 0)
  assert.deepEqual(snapshot, { isAuthenticated: false, refreshToken: null, user: null })
})

test("a failed refresh rejects waiters and expires only the still-current session", async () => {
  let calls = 0
  let logouts = 0
  const snapshot = { isAuthenticated: true, refreshToken: "refresh-a", user: { id: "user-1" } }
  const coordinate = createRefreshCoordinator({
    getAuth: () => snapshot,
    refresh: async () => { calls += 1; throw new Error("expired") },
    setAuth: () => assert.fail("failed refresh must not set credentials"),
    onFailure: () => { logouts += 1 },
  })
  await assert.rejects(coordinate("refresh-a"), /expired/)
  assert.equal(calls, 1)
  assert.equal(logouts, 1)
})

test("commercial retries reuse their scoped key and reject changed intent until cleared", async () => {
  const originalWindow = globalThis.window
  const values = new Map()
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  }
  try {
    const payload = { saleId: "sale-1", amount: 25 }
    const first = await prepareIdempotencyKey("SALE_RETURN", "user-1", "tenant-1", payload)
    const retry = await prepareIdempotencyKey("SALE_RETURN", "user-1", "tenant-1", { amount: 25, saleId: "sale-1" })
    assert.equal(retry, first)
    await assert.rejects(
      prepareIdempotencyKey("SALE_RETURN", "user-1", "tenant-1", { ...payload, amount: 30 }),
      IdempotencyIntentMismatchError,
    )
    clearIdempotencyKey("SALE_RETURN", "user-1", "tenant-1")
    const nextIntent = await prepareIdempotencyKey("SALE_RETURN", "user-1", "tenant-1", { ...payload, amount: 30 })
    assert.notEqual(nextIntent, first)
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})
