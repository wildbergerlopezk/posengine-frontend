import assert from "node:assert/strict"
import test from "node:test"
import {
  getLoginErrorMessage,
  validateLoginCredentials,
} from "../src/features/auth/utils/auth.utils.ts"

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
