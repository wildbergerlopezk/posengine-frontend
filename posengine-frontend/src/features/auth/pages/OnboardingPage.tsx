"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Building2, Loader2, Mail, CheckCircle2,
  Send, ChevronDown, RefreshCw,
} from "lucide-react"
import { useAuthStore } from "../store/auth.store"
import { createTenantApi, sendVerificationCodeApi, verifyCodeApi, getBusinessTypesApi } from "../api/auth.api"
import type { BusinessTypeDto } from "../types"
import type { RegisterTenantDto } from "@/src/shared/types/tenant/tenantType.dto"
import styles from "./OnboardingPage.module.css"
import typeStyles from "./BusinessTypeStep.module.css"

type Step = "business" | "business-type" | "send-code" | "verify" | "done"

export function OnboardingPage() {
  const router = useRouter()
  const { setTenant, setUser, user } = useAuthStore()

  const [step, setStep] = useState<Step>("business")
  const [isLoading, setIsLoading] = useState(false)
  const [businessName, setBusinessName] = useState("")
  const [businessType, setBusinessType] = useState("")
  const [error, setError] = useState("")

  const [businessTypes, setBusinessTypes] = useState<BusinessTypeDto[]>([])
  const [loadingTypes, setLoadingTypes] = useState(false)

  useEffect(() => {
    setLoadingTypes(true)
    getBusinessTypesApi()
      .then(setBusinessTypes)
      .catch(() => setError("No se pudieron cargar los tipos de negocio"))
      .finally(() => setLoadingTypes(false))
  }, [])

  const selectedType = businessTypes.find((t) => t.key === businessType) ?? null

  // ─── Paso 1 → 2 ───────────────────────────────────────────────────────────
  const handleBusinessName = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { setError("No hay usuario autenticado"); return }
    if (businessName.length < 3) { setError("El nombre debe tener al menos 3 caracteres"); return }
    setError("")
    setStep("business-type")
  }

  // ─── Paso 2: submit ────────────────────────────────────────────────────────
  const handleSelectTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !businessType) return
    setIsLoading(true)
    setError("")
    try {
      const tenantDto: RegisterTenantDto = { name: businessName, businessType }
      const tenant = await createTenantApi(user.id, tenantDto)
      setTenant(tenant)
      setUser({ ...user, tenantId: tenant.id })
      setStep("send-code")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el negocio")
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Paso 3 → 4 ───────────────────────────────────────────────────────────
  const handleSendCode = async () => {
    if (!user) return
    setIsLoading(true)
    setError("")
    try {
      await sendVerificationCodeApi(user.email)
      setStep("verify")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el código")
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Paso 4: verificar ────────────────────────────────────────────────────
  const handleResendCode = async () => {
    if (!user) throw new Error("No hay usuario autenticado")
    await sendVerificationCodeApi(user.email)
  }
  const handleVerifyCode = async (code: string) => {
    if (!user) throw new Error("No hay usuario autenticado")
    await verifyCodeApi(user.email, code)
  }
  const handleVerified = () => {
    setStep("done")
    setTimeout(() => router.push("/dashboard"), 1200)
  }

  // ─── Stepper ──────────────────────────────────────────────────────────────
  const STEPS = [
    { key: "business", label: "Negocio" },
    { key: "business-type", label: "Tipo" },
    { key: "verify", label: "Verificar" },
    { key: "done", label: "Listo" },
  ] as const

  const currentStepIndex =
    step === "business" ? 0 :
    step === "business-type" ? 1 :
    step === "send-code" ? 2 :
    step === "verify" ? 2 : 3

  // ─── Done ─────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <StepIndicator steps={STEPS} currentIndex={3} />
            <div className={styles.headerIconSuccess}>
              <CheckCircle2 size={24} />
            </div>
            <h1 className={styles.cardTitle}>¡Todo listo!</h1>
            <p className={styles.cardDescription}>
              Tu cuenta ha sido verificada. Redirigiendo al dashboard…
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Verify ───────────────────────────────────────────────────────────────
  if (step === "verify") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <StepIndicator steps={STEPS} currentIndex={currentStepIndex} />
          </div>
          <OtpVerification
            email={user?.email ?? ""}
            onVerified={handleVerified}
            onResendCode={handleResendCode}
            onVerifyCode={handleVerifyCode}
          />
        </div>
      </div>
    )
  }

  // ─── Send-code ────────────────────────────────────────────────────────────
  if (step === "send-code") {
    const maskedEmail = (user?.email ?? "").replace(
      /(.{2})(.*)(@.*)/,
      (_, a, b, c) => a + "*".repeat(b.length) + c
    )
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <StepIndicator steps={STEPS} currentIndex={currentStepIndex} />
            <div className={styles.headerIcon}><Mail size={24} /></div>
            <h1 className={styles.cardTitle}>Verifica tu cuenta</h1>
            <p className={styles.cardDescription}>
              Te enviaremos un código de 6 dígitos a{" "}
              <strong>{maskedEmail}</strong> para confirmar tu correo.
            </p>
          </div>
          <div className={styles.cardContent}>
            {error && <div className={styles.errorMessage}>{error}</div>}
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleSendCode}
              disabled={isLoading}
            >
              {isLoading
                ? <><Loader2 size={16} className={styles.spinner} /> Enviando código…</>
                : <><Send size={16} /> Enviar código de verificación</>
              }
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Business-type ────────────────────────────────────────────────────────
  if (step === "business-type") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <StepIndicator steps={STEPS} currentIndex={currentStepIndex} />
            <div className={styles.headerIcon}><Building2 size={24} /></div>
            <h1 className={styles.cardTitle}>¿Qué tipo de negocio es?</h1>
            <p className={styles.cardDescription}>
              Elegimos los módulos perfectos para <strong>{businessName}</strong>
            </p>
          </div>
          <form onSubmit={handleSelectTypeSubmit} className={styles.cardContent}>
            {error && <div className={styles.errorMessage}>{error}</div>}

            <div className={styles.formGroup}>
              <label className={styles.label}>Tipo de negocio *</label>

              <div className={typeStyles.selectWrapper}>
                <span className={typeStyles.selectIcon}>
                  <Building2 size={16} />
                </span>

                <select
                  className={`${typeStyles.select} ${businessType ? typeStyles.selectFilled : ""}`}
                  value={businessType}
                  onChange={(e) => { setBusinessType(e.target.value); setError("") }}
                  disabled={isLoading || loadingTypes}
                >
                  <option value="" disabled>
                    {loadingTypes ? "Cargando tipos…" : "Selecciona un tipo…"}
                  </option>
                  {businessTypes.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>

                <ChevronDown size={16} className={typeStyles.selectChevron} />
              </div>

              {selectedType && (
                <div className={typeStyles.selectedPreview}>
                  <div className={typeStyles.selectedPreviewInfo}>
                    <span className={typeStyles.selectedPreviewLabel}>
                      {selectedType.label}
                    </span>
                    <span className={typeStyles.selectedPreviewDesc}>
                      {selectedType.description}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading || !businessType || loadingTypes}
            >
              {isLoading
                ? <><Loader2 size={16} className={styles.spinner} /> Creando negocio…</>
                : "Continuar"
              }
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Business (paso 1) ────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <StepIndicator steps={STEPS} currentIndex={currentStepIndex} />
          <div className={styles.headerIcon}><Building2 size={24} /></div>
          <h1 className={styles.cardTitle}>Configura tu negocio</h1>
          <p className={styles.cardDescription}>
            Ingresa el nombre de tu negocio para comenzar
          </p>
        </div>
        <form onSubmit={handleBusinessName} className={styles.cardContent}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Nombre del negocio *</label>
            <input
              className={styles.input}
              placeholder="Ej: Mi Tienda"
              value={businessName}
              onChange={(e) => { setBusinessName(e.target.value); setError("") }}
              disabled={isLoading}
            />
            <p className={styles.hint}>Este nombre identificará tu negocio en el sistema</p>
          </div>
          {error && <div className={styles.errorMessage}>{error}</div>}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading || businessName.length < 3}
          >
            Continuar
          </button>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: StepIndicator
// ─────────────────────────────────────────────────────────────────────────────
interface StepIndicatorProps {
  steps: ReadonlyArray<{ key: string; label: string }>
  currentIndex: number
}

function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <div className={styles.steps}>
      {steps.map((s, i) => (
        <div key={s.key} className={styles.step}>
          <div className={`${styles.stepNumber} ${i <= currentIndex ? styles.stepNumberActive : styles.stepNumberInactive}`}>
            {i < currentIndex ? "✓" : i + 1}
          </div>
          <span className={`${styles.stepLabel} ${i <= currentIndex ? styles.stepLabelActive : styles.stepLabelInactive}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className={`${styles.stepConnector} ${i < currentIndex ? styles.stepConnectorActive : styles.stepConnectorInactive}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: OtpVerification
// ─────────────────────────────────────────────────────────────────────────────
interface OtpVerificationProps {
  email: string
  onVerified: () => void
  onResendCode: () => Promise<void>
  onVerifyCode: (code: string) => Promise<void>
}

function OtpVerification({ email, onVerified, onResendCode, onVerifyCode }: OtpVerificationProps) {
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)
  const [verified, setVerified] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendCooldown])

  useEffect(() => {
    const full = code.join("")
    if (full.length === 6 && code.every((d) => d !== "")) handleVerify(full)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1)
    const next = [...code]
    next[index] = digit
    setCode(next)
    setError("")
    if (digit && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (code[index]) {
        const next = [...code]; next[index] = ""; setCode(next)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus()
    else if (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (!pasted.length) return
    const next = [...code]
    for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? ""
    setCode(next)
    inputRefs.current[Math.min(pasted.length - 1, 5)]?.focus()
  }

  const handleVerify = async (fullCode: string) => {
    if (isVerifying) return
    setIsVerifying(true)
    setError("")
    try {
      await onVerifyCode(fullCode)
      setVerified(true)
      setTimeout(() => onVerified(), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido. Verifica e intenta de nuevo.")
      setCode(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return
    setIsResending(true)
    setError("")
    try {
      await onResendCode()
      setResendCooldown(60)
      setCode(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reenviar el código.")
    } finally {
      setIsResending(false)
    }
  }

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + "*".repeat(b.length) + c)

  return (
    <>
      <div className={styles.cardHeader} style={{ textAlign: "center" }}>
        <div className={styles.headerIcon}><Mail size={24} /></div>
        <h1 className={styles.cardTitle}>Verifica tu cuenta</h1>
        <p className={styles.cardDescription}>
          Enviamos un código de 6 dígitos a{" "}
          <strong style={{ color: "var(--color-foreground)" }}>{maskedEmail}</strong>
        </p>
      </div>

      <div className={styles.cardContent}>
        <div className={styles.form}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div style={otpStyles.otpContainer}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                style={{
                  width: "clamp(2.25rem, 12vw, 3rem)",
                  height: "clamp(2.75rem, 14vw, 3.5rem)",
                  textAlign: "center",
                  fontSize: "clamp(1.125rem, 4vw, 1.375rem)",
                  fontWeight: 700,
                  border: `1.5px solid ${verified ? "#16a34a" : error ? "#dc2626" : "var(--color-border)"}`,
                  borderRadius: "0.625rem",
                  background: verified
                    ? "rgba(22,163,74,0.06)"
                    : error
                      ? "rgba(239,68,68,0.06)"
                      : "var(--color-background)",
                  color: verified ? "#16a34a" : "var(--color-foreground)",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  cursor: isVerifying || verified ? "not-allowed" : "text",
                  opacity: isVerifying || verified ? 0.8 : 1,
                  flexShrink: 1,
                  minWidth: 0,
                }}
                disabled={isVerifying || verified}
                autoFocus={index === 0}
              />
            ))}
          </div>

          {verified && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", color: "#16a34a", fontSize: "0.875rem", fontWeight: 500 }}>
              <CheckCircle2 size={16} />
              <span>¡Cuenta verificada correctamente!</span>
            </div>
          )}

          {isVerifying && !verified && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", color: "var(--color-muted-foreground)", fontSize: "0.8125rem" }}>
              <Loader2 size={14} className={styles.spinner} />
              <span>Verificando código...</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.cardContent} style={{ paddingTop: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-muted-foreground)" }}>
            ¿No recibiste el código?
          </span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || isResending || verified}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.35rem",
              fontSize: "0.8125rem", fontWeight: 500,
              color: resendCooldown > 0 || isResending || verified
                ? "var(--color-muted-foreground)"
                : "var(--color-primary)",
              background: "transparent", border: "none",
              cursor: resendCooldown > 0 || isResending || verified ? "not-allowed" : "pointer",
              padding: "0.25rem 0.5rem", borderRadius: "0.375rem",
            }}
          >
            {isResending
              ? <Loader2 size={13} className={styles.spinner} />
              : <RefreshCw size={13} />
            }
            {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Enviar código nuevo"}
          </button>
        </div>
      </div>
    </>
  )
}

const otpStyles = {
  otpContainer: {
    display: "flex",
    gap: "0.5rem",
    justifyContent: "center",
    margin: "0.5rem 0",
    flexWrap: "nowrap" as const,
  } as React.CSSProperties,
}