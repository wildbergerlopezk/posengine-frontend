"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useLogin } from "../hooks/useLogin"
import { useAuthStore } from "../store/auth.store"
import { quickPinApi } from "../api/quick-pin.api"
import { validateLoginCredentials } from "../utils/auth.utils"
import { SixDigitPinInput } from "./SixDigitPinInput"
import styles from "./auth.module.css"

export function LoginForm() {
  const { login, isLoading, error, clearError } = useLogin()
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isRemember, setIsRemember] = useState(false)
  const [validationError, setValidationError] = useState("")
  const [pinReady, setPinReady] = useState(false)
  const [pinMode, setPinMode] = useState(false)
  const [checkingDevice, setCheckingDevice] = useState(true)
  const [pin, setPin] = useState<string[]>(() => Array.from({ length: 6 }, () => ""))
  const [pinError, setPinError] = useState("")
  const [pinLoading, setPinLoading] = useState(false)
  const pinRequestInFlight = useRef(false)
  const pinComplete = pin.every((digit) => /^\d$/.test(digit))

  useEffect(() => {
    let mounted = true
    quickPinApi.deviceStatus()
      .then((status) => {
        if (!mounted) return
        setPinReady(status.enabled)
        setPinMode(status.enabled)
      })
      .catch(() => {
        if (mounted) {
          setPinReady(false)
          setPinMode(false)
        }
      })
      .finally(() => { if (mounted) setCheckingDevice(false) })
    return () => { mounted = false }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    const validationMessage = validateLoginCredentials(email, password)
    setValidationError(validationMessage ?? "")
    if (validationMessage) return

    await login({ email, password, isRemember })
  }

  const clearDisplayedError = () => {
    setValidationError("")
    clearError()
  }

  const submitPin = useCallback(async () => {
    if (pinLoading || pinRequestInFlight.current || !pinComplete) return
    pinRequestInFlight.current = true
    setPinLoading(true)
    setPinError("")
    try {
      const response = await quickPinApi.login(pin.join(""))
      setPin(Array.from({ length: 6 }, () => ""))
      setAuth(response)
      router.replace("/dashboard")
    } catch (cause) {
      setPin(Array.from({ length: 6 }, () => ""))
      const message = cause instanceof Error ? cause.message : "No se pudo validar el PIN."
      try {
        const device = await quickPinApi.deviceStatus()
        if (!device.enabled) {
          setPinReady(false)
          setPinMode(false)
          setValidationError("Este dispositivo ya no está autorizado para el acceso rápido. Ingresá con correo y contraseña.")
          setPinError("")
          return
        }
      } catch {
        setPinReady(false)
        setPinMode(false)
        setValidationError("No se pudo verificar este dispositivo. Ingresá con correo y contraseña.")
        setPinError("")
        return
      }
      setPinError(message)
    } finally {
      pinRequestInFlight.current = false
      setPinLoading(false)
    }
  }, [pin, pinComplete, pinLoading, router, setAuth])

  useEffect(() => {
    if (!pinMode || !pinComplete || pinLoading || pinRequestInFlight.current) return
    void submitPin()
  }, [pinComplete, pinMode, pinLoading, submitPin])

  if (checkingDevice) {
    return (
      <div className={styles.supabaseFormContainer}>
        <div className={styles.supabaseHeader}>
          <h1 className={styles.supabaseTitle}>Iniciar sesión</h1>
          <p className={styles.supabaseSubtitle}>Accedé a tu sistema PosEngine</p>
        </div>
        <p className={styles.deviceCheck} role="status">Verificando este dispositivo…</p>
      </div>
    )
  }

  return (
    <div className={styles.supabaseFormContainer}>
      <div className={styles.supabaseHeader}>
        <h1 className={styles.supabaseTitle}>Iniciar sesión</h1>
        <p className={styles.supabaseSubtitle}>Accedé a tu sistema PosEngine</p>
      </div>

      {pinMode ? (
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void submitPin() }}>
          <p className={styles.pinPrompt}>Ingresá tu código de acceso rápido</p>
          <SixDigitPinInput
            label="Código de acceso rápido"
            value={pin}
            onChange={(value) => { setPin(value); setPinError("") }}
            disabled={pinLoading}
            autoFocus
            focusFirstOnClear
          />
          {pinError && <p role="alert" className={styles.errorMessage}>{pinError}</p>}
          <button type="button" className={styles.submitButton} disabled={pinLoading || !pinComplete} onClick={() => void submitPin()}>
            {pinLoading ? <><Loader2 size={16} className={styles.spinner} />Desbloqueando…</> : "Desbloquear"}
          </button>
          <button type="button" className={styles.modeLink} onClick={() => { setPinMode(false); setPin(Array.from({ length: 6 }, () => "")); setPinError("") }}>Ingresar con correo y contraseña</button>
          <p className={styles.registerLink}>¿No tienes una cuenta? <Link href="/register">Registrar empresa</Link></p>
        </form>
      ) : <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {(validationError || error) && (
          <div className={styles.errorMessage} role="alert" aria-live="polite">
            {validationError || error}
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="email" className={styles.label}>Email</label>
          <input
            id="email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              clearDisplayedError()
            }}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <div className={styles.labelRow}>
            <label htmlFor="password" className={styles.label}>Contraseña</label>
            <Link href="/forgot-password" className={styles.forgotLink}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className={styles.inputWrapper}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearDisplayedError()
              }}
              className={styles.input}
              required
            />
            <button
              type="button"
              className={styles.passwordToggle}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className={styles.rememberRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isRemember}
              onChange={(e) => setIsRemember(e.target.checked)}
              className={styles.checkbox}
            />
            Recordarme
          </label>
        </div>

        <button type="submit" className={styles.submitButton} disabled={isLoading}>
          {isLoading ? (
            <><Loader2 size={16} className={styles.spinner} />Ingresando...</>
          ) : (
            "Ingresar"
          )}
        </button>

        {pinReady && <button type="button" className={styles.modeLink} onClick={() => { setPinMode(true); setPin(Array.from({ length: 6 }, () => "")); setPinError("") }}>Acceder con PIN de acceso rápido</button>}

        <p className={styles.registerLink}>
          ¿No tienes una cuenta? <Link href="/register">Regístrate</Link>
        </p>
      </form>}
    </div>
  )
}
